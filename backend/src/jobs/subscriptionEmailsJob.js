'use strict'

const cron = require('node-cron')
const emailService = require('../services/emailService')
const { buildUrl } = require('../utils/unsubscribe')

// Письма жизненного цикла ПЛАТНОЙ подписки шлём на эти смещения (в днях) от subscription_until.
// Отрицательное — заранее («скоро закончится»), положительное — после окончания (мотивашки).
// Без auto_renew=true: ЮKassa не разрешает рекуррент самозанятым, поэтому таких пользователей
// сейчас нет, но фильтр оставлен на будущее (см. autoRenewReminderContent в emailService.js).
const SUBSCRIPTION_EMAIL_OFFSETS = [-3, 0, 3, 30]

function startSubscriptionEmailsJob(db) {
  // Раз в день в 09:30 (через полчаса после trial-emails, чтобы не толкаться за одну SMTP-сессию).
  cron.schedule('30 9 * * *', () => {
    runSubscriptionEmails(db)
  })
  console.log('[subscription-emails] Запущен: письма об окончании подписки каждый день в 09:30')
}

// mailer инъектируется для тестируемости (по умолчанию — реальный emailService).
async function runSubscriptionEmails(db, mailer = emailService) {
  try {
    // Кандидаты: реальные пользователи, подтверждён email, есть оплаченная подписка (была хотя бы
    // раз), без автопродления (рекуррент недоступен самозанятым — фильтр на будущее), у кого
    // смещение от subscription_until входит в список рассылки.
    const res = await db.query(`
      SELECT u.id, u.email, u.subscription_until,
             FLOOR(EXTRACT(EPOCH FROM (NOW() - u.subscription_until)) / 86400)::int AS offset_days
      FROM users u
      WHERE u.is_test = false
        AND u.email_verified = true
        AND u.email_optout = false
        AND u.subscription_until IS NOT NULL
        AND u.auto_renew = false
    `)

    const candidates = res.rows.filter(
      (u) => SUBSCRIPTION_EMAIL_OFFSETS.includes(u.offset_days)
    )
    if (candidates.length === 0) {
      console.log('[subscription-emails] Нет кандидатов на сегодня')
      return
    }

    let sent = 0
    let skipped = 0
    for (const u of candidates) {
      // Уже слали письмо на это смещение для этого цикла подписки?
      const dup = await db.query(
        'SELECT 1 FROM subscription_emails WHERE user_id = $1 AND subscription_until = $2 AND offset_days = $3',
        [u.id, u.subscription_until, u.offset_days]
      )
      if (dup.rows.length > 0) { skipped++; continue }

      const opts = { unsubscribeUrl: buildUrl(u.id) }
      const ok = await mailer.sendSubscriptionEmail(u.email, u.offset_days, opts)
      if (ok) {
        // Фиксируем факт отправки (идемпотентность). Гонка исключена — джоб один.
        await db.query(
          'INSERT INTO subscription_emails (user_id, subscription_until, offset_days) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [u.id, u.subscription_until, u.offset_days]
        )
        sent++
      } else {
        // Почта отключена/ошибка — НЕ фиксируем, попробуем в следующий запуск.
        skipped++
      }
    }

    console.log(`[subscription-emails] Готово: отправлено=${sent}, пропущено=${skipped}`)
  } catch (err) {
    console.error('[subscription-emails] Критическая ошибка:', err.message)
  }
}

module.exports = { startSubscriptionEmailsJob, runSubscriptionEmails, SUBSCRIPTION_EMAIL_OFFSETS }
