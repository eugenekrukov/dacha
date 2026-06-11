'use strict'

const yookassa = require('../services/yookassaService')
const { extendSubscription, revokeSubscription } = require('../utils/access')

// Прямые платежи ЮKassa. Заменяют синк RuStore-подписки (POST /auth/subscription).
// create-payment → клиент открывает confirmation_url; webhook payment.succeeded продлевает
// subscription_until и сохраняет карту для автопродления; cancel-autorenew выключает рекуррент.
module.exports = async function (fastify, opts) {
  // Сервис инъектируется для тестируемости (по умолчанию — реальный).
  const yk = (opts && opts.yookassa) || yookassa

  // POST /billing/create-payment {plan} — создаёт платёж, возвращает ссылку на оплату.
  fastify.post('/create-payment', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['plan'],
        properties: { plan: { type: 'string', enum: ['monthly', 'yearly'] } }
      }
    }
  }, async (request, reply) => {
    if (!yk.isEnabled()) return reply.code(503).send({ error: 'billing_disabled' })

    const db = fastify.db
    const userRes = await db.query('SELECT id, email FROM users WHERE id = $1', [request.user.userId])
    const user = userRes.rows[0]
    if (!user) return reply.code(404).send({ error: 'user_not_found' })

    let payment
    try {
      payment = await yk.createPayment(user, request.body.plan)
    } catch (e) {
      fastify.log.error(`[billing] createPayment failed: ${e.message}`)
      return reply.code(502).send({ error: 'payment_provider_error' })
    }

    // Фиксируем платёж как pending (продление произойдёт по вебхуку payment.succeeded).
    await db.query(
      `INSERT INTO payments (user_id, yk_payment_id, status, amount, plan, is_recurring)
       VALUES ($1, $2, 'pending', $3, $4, false)
       ON CONFLICT (yk_payment_id) DO NOTHING`,
      [user.id, payment.id, yk.getPlan(request.body.plan).amount, request.body.plan]
    )

    return { payment_id: payment.id, confirmation_url: payment.confirmation_url, status: payment.status }
  })

  // POST /billing/webhook — уведомления ЮKassa (публичный, без JWT).
  // Безопасность: при включённом биллинге перезапрашиваем платёж из API (источник истины),
  // а не доверяем телу запроса. Идемпотентность — по payments.yk_payment_id.
  fastify.post('/webhook', async (request, reply) => {
    const body = request.body || {}
    const event = body.event
    let object = body.object
    if (!object || !object.id) return reply.code(200).send({ ok: true })

    const db = fastify.db

    // --- Возврат средств: отзываем период, выданный исходным платежом ---
    // refund.succeeded → object = объект ВОЗВРАТА (object.id — id возврата, object.payment_id —
    // исходный платёж). НЕ перезапрашиваем как payment; верифицируем через getRefund.
    // Без обработки клиент мог бы оплатить → вернуть деньги → пользоваться доступом бесплатно.
    if (event === 'refund.succeeded') {
      let refund = object
      if (yk.isEnabled()) {
        try {
          refund = await yk.getRefund(object.id)
        } catch (e) {
          fastify.log.error(`[billing] webhook getRefund failed: ${e.message}`)
          return reply.code(500).send({ error: 'verify_failed' })  // 500 → ЮKassa повторит
        }
      }
      if (refund.status !== 'succeeded' || !refund.payment_id) {
        return reply.code(200).send({ ok: true })
      }

      const payRes = await db.query(
        'SELECT user_id, plan, status FROM payments WHERE yk_payment_id = $1', [refund.payment_id]
      )
      const pay = payRes.rows[0]
      if (!pay) return reply.code(200).send({ ok: true })
      if (pay.status === 'refunded') return reply.code(200).send({ ok: true })  // идемпотентность

      // Полный возврат за период → вычитаем выданные дни. Частичные возвраты не про-рейтим
      // (бизнес-модель — разовая оплата за период; возврат = отмена этого периода).
      const planCfg = yk.getPlan(pay.plan) || yk.getPlan('monthly')
      const userRes = await db.query('SELECT subscription_until FROM users WHERE id = $1', [pay.user_id])
      const current = userRes.rows[0] && userRes.rows[0].subscription_until
      const until = revokeSubscription(current, planCfg.days)

      await db.query(
        'UPDATE users SET subscription_until = $1, auto_renew = false WHERE id = $2',
        [until, pay.user_id]
      )
      await db.query(
        "UPDATE payments SET status = 'refunded' WHERE yk_payment_id = $1", [refund.payment_id]
      )
      return reply.code(200).send({ ok: true })
    }

    // Доверяем не телу, а перезапрошенному из ЮKassa объекту (защита от подделки).
    if (yk.isEnabled()) {
      try {
        object = await yk.getPayment(object.id)
      } catch (e) {
        fastify.log.error(`[billing] webhook getPayment failed: ${e.message}`)
        return reply.code(500).send({ error: 'verify_failed' })  // 500 → ЮKassa повторит
      }
    }

    const status = object.status   // succeeded | canceled | pending | waiting_for_capture
    const userId = parseInt(object.metadata && object.metadata.user_id)
    const plan = object.metadata && object.metadata.plan

    if (!userId) return reply.code(200).send({ ok: true })

    // Идемпотентность: если этот платёж уже отмечен succeeded — выходим.
    const existing = await db.query('SELECT status FROM payments WHERE yk_payment_id = $1', [object.id])
    if (existing.rows[0] && existing.rows[0].status === 'succeeded') {
      return reply.code(200).send({ ok: true })
    }

    if (status === 'succeeded' || event === 'payment.succeeded') {
      const planCfg = yk.getPlan(plan) || yk.getPlan('monthly')
      const isRecurring = !!(object.metadata && object.metadata.recurring)

      const userRes = await db.query('SELECT subscription_until FROM users WHERE id = $1', [userId])
      const current = userRes.rows[0] && userRes.rows[0].subscription_until
      const until = extendSubscription(current, planCfg.days)

      // Сохранённая карта для автосписаний (если ЮKassa вернула saved=true).
      const pm = object.payment_method
      const savedCardId = pm && pm.saved ? pm.id : null

      // Автопродление включаем только если карта реально сохранена (рекуррент-режим магазина).
      // При разовой оплате (самозанятый) карта не сохраняется → auto_renew=false, продление вручную.
      const autoRenew = savedCardId != null
      await db.query(
        `UPDATE users
         SET subscription_until = $1,
             plan = $2,
             auto_renew = $3,
             payment_method_id = COALESCE($4, payment_method_id)
         WHERE id = $5`,
        [until, plan || 'monthly', autoRenew, savedCardId, userId]
      )

      const amount = object.amount && object.amount.value
      await db.query(
        `INSERT INTO payments (user_id, yk_payment_id, status, amount, plan, is_recurring)
         VALUES ($1, $2, 'succeeded', $3, $4, $5)
         ON CONFLICT (yk_payment_id) DO UPDATE SET status = 'succeeded'`,
        [userId, object.id, amount, plan || 'monthly', isRecurring]
      )
      return reply.code(200).send({ ok: true })
    }

    if (status === 'canceled' || event === 'payment.canceled') {
      await db.query(
        `INSERT INTO payments (user_id, yk_payment_id, status, plan)
         VALUES ($1, $2, 'canceled', $3)
         ON CONFLICT (yk_payment_id) DO UPDATE SET status = 'canceled'`,
        [userId, object.id, plan || null]
      )
      return reply.code(200).send({ ok: true })
    }

    // Прочие статусы (pending/waiting) — подтверждаем приём, ничего не меняем.
    return reply.code(200).send({ ok: true })
  })

  // POST /billing/cancel-autorenew — выключает автопродление. Доступ доживает до subscription_until.
  fastify.post('/cancel-autorenew', {
    onRequest: [fastify.authenticate]
  }, async (request) => {
    const res = await fastify.db.query(
      'UPDATE users SET auto_renew = false WHERE id = $1 RETURNING auto_renew, subscription_until',
      [request.user.userId]
    )
    return {
      auto_renew: res.rows[0] ? res.rows[0].auto_renew : false,
      subscription_until: res.rows[0] ? res.rows[0].subscription_until : null
    }
  })
}
