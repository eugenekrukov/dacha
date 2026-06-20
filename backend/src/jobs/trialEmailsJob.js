'use strict'

const cron = require('node-cron')
const emailService = require('../services/emailService')
const { buildUrl } = require('../utils/unsubscribe')

// Письма жизненного цикла триала шлём на эти дни триала (день 0 = регистрация).
// День 0 не используем — приветствие закрывает письмо с кодом подтверждения.
const TRIAL_EMAIL_DAYS = [1, 3, 5, 6, 8]

function startTrialEmailsJob(db) {
  // Раз в день в 09:00. Шлём не чаще одного письма на (user, day) — идемпотентность через trial_emails.
  cron.schedule('0 9 * * *', () => {
    runTrialEmails(db)
  })
  console.log('[trial-emails] Запущен: письма жизненного цикла триала каждый день в 09:00')
}

// mailer инъектируется для тестируемости (по умолчанию — реальный emailService).
async function runTrialEmails(db, mailer = emailService) {
  try {
    // Кандидаты: реальные пользователи (не тест), подтверждён email, триал стартовал,
    // ещё НЕ оплатившие (нет активной подписки), у кого день триала входит в список рассылки
    // и письмо на этот день ещё не отправлялось.
    const res = await db.query(`
      SELECT u.id, u.email, u.name,
             FLOOR(EXTRACT(EPOCH FROM (NOW() - u.trial_started_at)) / 86400)::int AS day,
             EXISTS(SELECT 1 FROM gardens g WHERE g.user_id = u.id) AS has_garden
      FROM users u
      WHERE u.is_test = false
        AND u.email_verified = true
        AND u.email_optout = false
        AND u.trial_started_at IS NOT NULL
        AND (u.subscription_until IS NULL OR u.subscription_until <= NOW())
    `)

    const candidates = res.rows.filter(
      (u) => TRIAL_EMAIL_DAYS.includes(u.day)
    )
    if (candidates.length === 0) {
      console.log('[trial-emails] Нет кандидатов на сегодня')
      return
    }

    let sent = 0
    let skipped = 0
    for (const u of candidates) {
      // Уже слали письмо на этот день?
      const dup = await db.query(
        'SELECT 1 FROM trial_emails WHERE user_id = $1 AND day = $2',
        [u.id, u.day]
      )
      if (dup.rows.length > 0) { skipped++; continue }

      // Для писем «в цифрах» (день 5/6) подтягиваем статистику пользователя.
      let stats = {}
      if (u.day === 5 || u.day === 6) {
        stats = await userStats(db, u.id)
      }

      // Контент ветвится по наличию участка (день 1 и день 5); ссылка отписки — на каждого.
      const opts = { hasGarden: u.has_garden, unsubscribeUrl: buildUrl(u.id) }
      const ok = await mailer.sendTrialEmail(u.email, u.name, u.day, stats, opts)
      if (ok) {
        // Фиксируем факт отправки (идемпотентность). Гонка исключена — джоб один.
        await db.query(
          'INSERT INTO trial_emails (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [u.id, u.day]
        )
        sent++
      } else {
        // Почта отключена/ошибка — НЕ фиксируем, попробуем в следующий запуск.
        skipped++
      }
    }

    console.log(`[trial-emails] Готово: отправлено=${sent}, пропущено=${skipped}`)
  } catch (err) {
    console.error('[trial-emails] Критическая ошибка:', err.message)
  }
}

/** Сводка для письма «в цифрах»: число посадок и записанных действий пользователя. */
async function userStats(db, userId) {
  const r = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM plantings p
        JOIN gardens g ON g.id = p.garden_id
        WHERE g.user_id = $1)::int AS plantings,
       (SELECT COUNT(*) FROM action_logs al
        JOIN plantings p ON p.id = al.planting_id
        JOIN gardens g   ON g.id = p.garden_id
        WHERE g.user_id = $1)::int AS actions`,
    [userId]
  )
  return r.rows[0] || { plantings: 0, actions: 0 }
}

module.exports = { startTrialEmailsJob, runTrialEmails, TRIAL_EMAIL_DAYS }
