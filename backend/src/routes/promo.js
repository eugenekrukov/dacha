'use strict'

const { LIFETIME_UNTIL, PROMO_MONTH_DAYS, hasPromo, isLifetimePromo } = require('../utils/access')

module.exports = async function (fastify) {
  // POST /promo/redeem — погашение промокода. Выдаёт бесплатный доступ к платным функциям.
  // Коды одноразовые. Гонка двойного погашения исключена атомарным UPDATE с условием
  // redeemed_by IS NULL (claim-first): код «забирается» одним запросом, доступ выдаётся после.
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
      'SELECT type, duration_days, expires_at, redeemed_by FROM promo_codes WHERE code = $1',
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

    // Атомарно забираем код: сработает только если он ещё не погашен
    const claim = await db.query(
      `UPDATE promo_codes SET redeemed_by = $1, redeemed_at = NOW()
       WHERE code = $2 AND redeemed_by IS NULL
       RETURNING type, duration_days`,
      [userId, code]
    )
    if (claim.rows.length === 0) {
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
