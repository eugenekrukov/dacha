'use strict'

const { LIFETIME_UNTIL, PROMO_MONTH_DAYS, hasPromo, isLifetimePromo } = require('../utils/access')

module.exports = async function (fastify) {
  // POST /promo/redeem — погашение промокода. Выдаёт бесплатный доступ к платным функциям.
  // Код можно погасить max_uses раз (1 = одноразовый, больше = мультиключ для блогера), но
  // не дважды одним пользователем. Гонки исключены атомарным UPDATE ... WHERE uses < max_uses
  // (claim-first) плюс PK (code, user_id) в promo_redemptions.
  fastify.post('/redeem', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: { code: { type: 'string', minLength: 1, maxLength: 64 } }
      }
    }
  }, async (request, reply) => {
    const code = String(request.body.code).trim().toUpperCase()
    const userId = request.user.userId
    const db = fastify.db

    // Существует ли код вообще (для различения 404 «нет такого» и 409 «уже использован»)
    const codeRes = await db.query(
      'SELECT type, duration_days, expires_at FROM promo_codes WHERE code = $1',
      [code]
    )
    if (codeRes.rows.length === 0) {
      return reply.code(404).send({ error: 'invalid_code' })
    }

    // Истёк ли срок активации кода (дедлайн). Проверяем до claim — это просто время, без гонок.
    const expiresAt = codeRes.rows[0].expires_at
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return reply.code(410).send({ error: 'code_expired' })
    }

    // Атомарно забираем одну активацию: сработает, только если лимит ещё не исчерпан.
    // redeemed_by/redeemed_at фиксируют первого погасившего (для старых выборок).
    const claim = await db.query(
      `UPDATE promo_codes
       SET uses = uses + 1,
           redeemed_by = COALESCE(redeemed_by, $1),
           redeemed_at = COALESCE(redeemed_at, NOW())
       WHERE code = $2 AND uses < max_uses
       RETURNING type, duration_days`,
      [userId, code]
    )
    if (claim.rows.length === 0) {
      return reply.code(409).send({ error: 'code_already_used' })
    }

    // Один пользователь — одна активация кода. Конфликт PK → возвращаем активацию в лимит.
    const mine = await db.query(
      `INSERT INTO promo_redemptions (code, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING 1`,
      [code, userId]
    )
    if (mine.rows.length === 0) {
      await db.query('UPDATE promo_codes SET uses = uses - 1 WHERE code = $1', [code])
      return reply.code(409).send({ error: 'code_already_used' })
    }

    const { type, duration_days: durationDays } = claim.rows[0]

    // Считаем новую дату промо-доступа.
    // duration_days = NULL → lifetime (навсегда); иначе доступ на N дней (для month — 30 по бэкофиллу).
    const userRes = await db.query('SELECT promo_until FROM users WHERE id = $1', [userId])
    const current = userRes.rows[0] && userRes.rows[0].promo_until
    const days = durationDays != null ? durationDays : (type === 'month' ? PROMO_MONTH_DAYS : null)

    let promoUntil
    if (days == null || isLifetimePromo(current)) {
      // Навсегда — и не понижаем уже выданный lifetime
      promoUntil = new Date(LIFETIME_UNTIL)
    } else {
      // Продлеваем от большего из (сейчас, текущая дата промо)
      const base = hasPromo(current) ? new Date(current) : new Date()
      promoUntil = new Date(base.getTime() + days * 86_400_000)
    }

    await db.query('UPDATE users SET promo_until = $1 WHERE id = $2', [promoUntil, userId])

    return {
      type,
      promo_until: promoUntil,
      promo_active: hasPromo(promoUntil),
      promo_lifetime: isLifetimePromo(promoUntil)
    }
  })
}
