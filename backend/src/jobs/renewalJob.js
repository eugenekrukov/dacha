'use strict'

const cron = require('node-cron')
const yookassaService = require('../services/yookassaService')

// Автопродление подписок (рекуррент). Раз в день списывает по сохранённой карте тех, у кого
// подписка истекает в ближайшие сутки, включено auto_renew и есть payment_method_id.
// Реальное продление subscription_until делает вебхук payment.succeeded — джоб только инициирует
// списание (единый источник истины по дате доступа = вебхук, без двойного продления).
function startRenewalJob(db) {
  cron.schedule('0 10 * * *', () => {
    runRenewals(db)
  })
  console.log('[renewal-job] Запущен: автопродление подписок каждый день в 10:00')
}

// yk инъектируется для тестируемости (по умолчанию — реальный сервис).
async function runRenewals(db, yk = yookassaService) {
  if (!yk.isEnabled()) {
    console.log('[renewal-job] ЮKassa отключена — автопродление пропущено')
    return
  }

  try {
    // Кандидаты: автопродление включено, карта привязана, подписка ещё активна, но истекает ≤1 дня.
    // Защита от повторного списания: нет недавнего рекуррент-платежа (за 2 дня) в статусе
    // pending/succeeded — иначе джоб мог бы списать дважды до прихода вебхука.
    const res = await db.query(`
      SELECT u.id, u.email, u.plan, u.subscription_until, u.payment_method_id
      FROM users u
      WHERE u.auto_renew = true
        AND u.payment_method_id IS NOT NULL
        AND u.subscription_until IS NOT NULL
        AND u.subscription_until > NOW()
        AND u.subscription_until <= NOW() + INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.user_id = u.id AND p.is_recurring = true
            AND p.status IN ('pending', 'succeeded')
            AND p.created_at > NOW() - INTERVAL '2 days'
        )
    `)

    if (res.rows.length === 0) {
      console.log('[renewal-job] Нет подписок к автопродлению')
      return
    }

    let charged = 0
    let failed = 0
    for (const user of res.rows) {
      const plan = user.plan || 'monthly'
      try {
        const payment = await yk.chargeRecurring(user, plan)
        // Фиксируем рекуррент-платёж как pending; продление — по вебхуку.
        await db.query(
          `INSERT INTO payments (user_id, yk_payment_id, status, amount, plan, is_recurring)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (yk_payment_id) DO NOTHING`,
          [user.id, payment.id, payment.status || 'pending', yk.getPlan(plan).amount, plan]
        )
        charged++
      } catch (e) {
        failed++
        console.error(`[renewal-job] Списание для user ${user.id} не удалось: ${e.message}`)
      }
    }

    console.log(`[renewal-job] Готово: инициировано=${charged}, ошибок=${failed}`)
  } catch (err) {
    console.error('[renewal-job] Критическая ошибка:', err.message)
  }
}

module.exports = { startRenewalJob, runRenewals }
