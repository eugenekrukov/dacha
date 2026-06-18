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

  // 1) Аннулирование чеков по возвратам.
  const cancelRes = await db.query(
    `UPDATE payments SET npd_status = 'cancel_pending'
     WHERE npd_status = 'cancel_pending'
       AND id IN (SELECT id FROM payments WHERE npd_status = 'cancel_pending' ORDER BY created_at LIMIT 2)
     RETURNING id, npd_receipt_uuid`
  )
  for (const row of cancelRes.rows) {
    try {
      await nalog.cancelIncome(db, row.npd_receipt_uuid, 'REFUND')
      await db.query("UPDATE payments SET npd_status = 'canceled' WHERE id = $1", [row.id])
    } catch (e) {
      console.error(`[nalog-job] Отмена чека payment ${row.id} не удалась: ${e.message}`)
      await db.query('UPDATE payments SET npd_last_error = $1 WHERE id = $2', [e.message, row.id])
    }
  }

  // 2) Регистрация дохода по успешным платежам. Claim ≤ 2.
  const pendingRes = await db.query(
    `UPDATE payments SET npd_status = 'pending'
     WHERE npd_status = 'pending'
       AND id IN (SELECT id FROM payments WHERE npd_status = 'pending' ORDER BY created_at LIMIT 2)
     RETURNING id, user_id, amount, plan, created_at, npd_attempts,
               (SELECT email FROM users WHERE users.id = payments.user_id) AS email`
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
      await db.query(
        `UPDATE payments SET npd_status = 'registered', npd_receipt_uuid = $1, npd_registered_at = NOW(), npd_last_error = NULL
         WHERE id = $2`,
        [uuid, row.id]
      )
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
        console.error(`[nalog-job] Чек payment ${row.id} помечен failed после ${attempts} попыток: ${e.message}`)
        if (process.env.ADMIN_EMAIL) {
          await email.sendReceiptLink(process.env.ADMIN_EMAIL, '-', `СБОЙ регистрации чека payment ${row.id}: ${e.message}`, row.amount).catch(() => {})
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

module.exports = { startNalogJob, runNalogReceipts }
