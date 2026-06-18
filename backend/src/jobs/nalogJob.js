'use strict'

const cron = require('node-cron')
const nalogService = require('../services/nalogService')
const emailService = require('../services/emailService')

const MAX_ATTEMPTS = 5

const PLAN_DESC = {
  monthly: 'Подписка «Календарь дачника» — 1 месяц',
  yearly: 'Подписка «Календарь дачника» — 1 год'
}

// Регистрация чеков НПД раз в 5 минут. Батч ≤ 2 за прогон (rate-limit ФНС 2 запроса/мин).
function startNalogJob(db) {
  cron.schedule('*/5 * * * *', () => { runNalogReceipts(db) })
  console.log('[nalog-job] Запущен: регистрация чеков НПД каждые 5 минут')
}

// deps инъектируются в тестах.
async function runNalogReceipts(db, nalog = nalogService, email = emailService) {
  if (!nalog.isEnabled()) {
    console.log('[nalog-job] «Мой налог» отключён — регистрация чеков пропущена')
    return
  }

  // Бюджет вызовов ФНС за прогон: не больше 2 (лимит «не чаще 2 запросов/мин»), делится между
  // отменами и регистрациями. Примечание: claim-UPDATE пишет тот же статус (no-op) и НЕ защищает
  // от параллельных воркеров — расчёт на один инстанс pm2 и непересекающийся cron (то же допущение,
  // что в nalogService.getAccessToken).
  let budget = 2
  let registered = 0
  let canceled = 0
  let failed = 0

  // 1) Аннулирование чеков по возвратам.
  if (budget > 0) {
    const cancelRes = await db.query(
      `UPDATE payments SET npd_status = 'cancel_pending'
       WHERE npd_status = 'cancel_pending'
         AND id IN (SELECT id FROM payments WHERE npd_status = 'cancel_pending' ORDER BY created_at LIMIT $1)
       RETURNING id, npd_receipt_uuid, npd_attempts`,
      [budget]
    )
    for (const row of cancelRes.rows) {
      try {
        await nalog.cancelIncome(db, row.npd_receipt_uuid, 'REFUND')
        await db.query("UPDATE payments SET npd_status = 'canceled' WHERE id = $1", [row.id])
        canceled++
      } catch (e) {
        const attempts = (row.npd_attempts || 0) + 1
        if (attempts >= MAX_ATTEMPTS) {
          await db.query(
            "UPDATE payments SET npd_status = 'failed', npd_attempts = $1, npd_last_error = $2 WHERE id = $3",
            [attempts, e.message, row.id]
          )
          failed++
          console.error(`[nalog-job] Отмена чека payment ${row.id} помечена failed после ${attempts} попыток: ${e.message}`)
          if (process.env.ADMIN_EMAIL && email.sendMail) {
            await email.sendMail(
              process.env.ADMIN_EMAIL,
              `СБОЙ аннулирования чека НПД (payment ${row.id})`,
              `Аннулирование чека для payment ${row.id} не удалось после ${attempts} попыток.\nОшибка: ${e.message}`
            ).catch(() => {})
          }
        } else {
          await db.query(
            'UPDATE payments SET npd_attempts = $1, npd_last_error = $2 WHERE id = $3',
            [attempts, e.message, row.id]
          )
          console.error(`[nalog-job] Отмена чека payment ${row.id} не удалась (попытка ${attempts}): ${e.message}`)
        }
      }
    }
    budget -= cancelRes.rows.length
  }

  // 2) Регистрация дохода по успешным платежам. Остаток бюджета.
  if (budget > 0) {
    const pendingRes = await db.query(
      `UPDATE payments SET npd_status = 'pending'
       WHERE npd_status = 'pending'
         AND id IN (SELECT id FROM payments WHERE npd_status = 'pending' ORDER BY created_at LIMIT $1)
       RETURNING id, user_id, amount, plan, created_at, npd_attempts,
                 (SELECT email FROM users WHERE users.id = payments.user_id) AS email`,
      [budget]
    )

    for (const row of pendingRes.rows) {
      try {
        const description = PLAN_DESC[row.plan] || PLAN_DESC.monthly
        const uuid = await nalog.addIncome(db, {
          name: description,
          amount: Number(row.amount),
          quantity: 1,
          operationTime: row.created_at
        })
        // Узкое окно: если addIncome прошёл в ФНС, а этот UPDATE упал, строка останется pending и
        // на следующем прогоне доход зарегистрируется повторно (у ФНС нет ключа идемпотентности).
        await db.query(
          `UPDATE payments SET npd_status = 'registered', npd_receipt_uuid = $1, npd_registered_at = NOW(), npd_attempts = 0, npd_last_error = NULL
           WHERE id = $2`,
          [uuid, row.id]
        )
        registered++
        if (row.email) {
          await email.sendReceiptLink(row.email, nalog.getReceiptUrl(uuid), description, row.amount)
        }
      } catch (e) {
        const attempts = (row.npd_attempts || 0) + 1
        if (attempts >= MAX_ATTEMPTS) {
          await db.query(
            "UPDATE payments SET npd_status = 'failed', npd_attempts = $1, npd_last_error = $2 WHERE id = $3",
            [attempts, e.message, row.id]
          )
          failed++
          console.error(`[nalog-job] Чек payment ${row.id} помечен failed после ${attempts} попыток: ${e.message}`)
          if (process.env.ADMIN_EMAIL && email.sendMail) {
            await email.sendMail(
              process.env.ADMIN_EMAIL,
              `СБОЙ регистрации чека НПД (payment ${row.id})`,
              `Регистрация чека для payment ${row.id} не удалась после ${attempts} попыток.\nОшибка: ${e.message}`
            ).catch(() => {})
          }
        } else {
          await db.query(
            'UPDATE payments SET npd_attempts = $1, npd_last_error = $2 WHERE id = $3',
            [attempts, e.message, row.id]
          )
          console.error(`[nalog-job] Регистрация чека payment ${row.id} не удалась (попытка ${attempts}): ${e.message}`)
        }
      }
    }
  }

  console.log(`[nalog-job] Готово: зарегистрировано=${registered}, отменено=${canceled}, ошибок=${failed}`)
}

module.exports = { startNalogJob, runNalogReceipts }
