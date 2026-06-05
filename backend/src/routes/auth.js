'use strict'

const bcrypt = require('bcrypt')
const { trialInfo, isSubscribed, hasPromo, isLifetimePromo, SUBSCRIPTION_WINDOW_DAYS } = require('../utils/access')
const { generateCode, sendVerificationCode, sendPasswordResetCode } = require('../services/emailService')

const CODE_TTL_MS = 15 * 60 * 1000  // коды подтверждения/сброса живут 15 минут

// Выпускает новый одноразовый код, гасит прежние неиспользованные того же назначения.
async function issueCode(db, userId, purpose) {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  await db.query(
    "UPDATE email_codes SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL",
    [userId, purpose]
  )
  await db.query(
    'INSERT INTO email_codes (user_id, code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, code, purpose, expiresAt]
  )
  return code
}

// Находит id валидного (не использованного, не истёкшего) кода. null если нет.
async function findValidCode(db, userId, purpose, code) {
  const r = await db.query(
    `SELECT id FROM email_codes
     WHERE user_id = $1 AND purpose = $2 AND code = $3
       AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId, purpose, String(code).trim()]
  )
  return r.rows[0]?.id ?? null
}

module.exports = async function (fastify) {
  // POST /auth/register
  fastify.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name:     { type: 'string' }   // опционально (имя больше не собирается клиентом)
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, name } = request.body
    const db = fastify.db

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return reply.code(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at, trial_started_at, email_verified',
      [email, passwordHash, name ?? null]
    )

    const user = result.rows[0]
    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

    // Отправляем код подтверждения email (best-effort — не валим регистрацию при сбое почты).
    try {
      const code = await issueCode(db, user.id, 'verify')
      await sendVerificationCode(user.email, code)
    } catch (e) {
      fastify.log.warn(`[auth] не удалось отправить код подтверждения: ${e.message}`)
    }

    return reply.code(201).send({ token, user: { ...user, ...trialInfo(user.trial_started_at) } })
  })

  // POST /auth/login
  fastify.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body
    const db = fastify.db

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

    return { token, user: { id: user.id, email: user.email, name: user.name } }
  })

  // GET /auth/me
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request) => {
    const result = await fastify.db.query(
      'SELECT id, email, name, push_token, notification_settings, created_at, trial_started_at, subscription_until, promo_until, email_verified FROM users WHERE id = $1',
      [request.user.userId]
    )
    const user = result.rows[0]
    if (!user) return user
    return {
      ...user,
      ...trialInfo(user.trial_started_at),
      subscribed: isSubscribed(user.subscription_until),
      promo_active: hasPromo(user.promo_until),
      promo_lifetime: isLifetimePromo(user.promo_until),
      promo_until: hasPromo(user.promo_until) ? user.promo_until : null
    }
  })

  // POST /auth/subscription — клиент синхронизирует статус подписки из RuStore.
  // active=true продлевает серверное окно подтверждения; active=false снимает.
  fastify.post('/subscription', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['active'],
        properties: { active: { type: 'boolean' } }
      }
    }
  }, async (request) => {
    const until = request.body.active
      ? new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * 86_400_000)
      : null
    const result = await fastify.db.query(
      'UPDATE users SET subscription_until = $1 WHERE id = $2 RETURNING subscription_until',
      [until, request.user.userId]
    )
    return { subscription_until: result.rows[0].subscription_until, subscribed: isSubscribed(result.rows[0].subscription_until) }
  })

  // POST /auth/verify-email — подтверждение email кодом из письма (текущий пользователь).
  fastify.post('/verify-email', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const userId = request.user.userId
    const codeId = await findValidCode(db, userId, 'verify', request.body.code)
    if (codeId === null) return reply.code(400).send({ error: 'invalid_or_expired_code' })

    await db.query('UPDATE email_codes SET used_at = NOW() WHERE id = $1', [codeId])
    await db.query('UPDATE users SET email_verified = true WHERE id = $1', [userId])
    return { email_verified: true }
  })

  // POST /auth/resend-verification — повторно отправить код подтверждения (текущий пользователь).
  fastify.post('/resend-verification', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } }
  }, async (request) => {
    const db = fastify.db
    const res = await db.query('SELECT email, email_verified FROM users WHERE id = $1', [request.user.userId])
    const user = res.rows[0]
    if (user && !user.email_verified) {
      try {
        const code = await issueCode(db, request.user.userId, 'verify')
        await sendVerificationCode(user.email, code)
      } catch (e) {
        fastify.log.warn(`[auth] resend-verification: ${e.message}`)
      }
    }
    return { ok: true }
  })

  // POST /auth/forgot-password — запрос кода сброса пароля (публичный).
  // Всегда отвечает 200 — не раскрываем, существует ли email (защита от перечисления).
  fastify.post('/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }
    }
  }, async (request) => {
    const db = fastify.db
    const res = await db.query('SELECT id FROM users WHERE email = $1', [request.body.email])
    if (res.rows.length > 0) {
      try {
        const code = await issueCode(db, res.rows[0].id, 'reset')
        await sendPasswordResetCode(request.body.email, code)
      } catch (e) {
        fastify.log.warn(`[auth] forgot-password: ${e.message}`)
      }
    }
    return { ok: true }
  })

  // POST /auth/reset-password — установка нового пароля по коду из письма (публичный).
  fastify.post('/reset-password', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          code:     { type: 'string' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const { email, code, password } = request.body
    const res = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (res.rows.length === 0) return reply.code(400).send({ error: 'invalid_or_expired_code' })

    const userId = res.rows[0].id
    const codeId = await findValidCode(db, userId, 'reset', code)
    if (codeId === null) return reply.code(400).send({ error: 'invalid_or_expired_code' })

    const passwordHash = await bcrypt.hash(password, 10)
    await db.query('UPDATE email_codes SET used_at = NOW() WHERE id = $1', [codeId])
    // Раз пользователь получил код на почту — он ею владеет, заодно подтверждаем email.
    await db.query('UPDATE users SET password_hash = $1, email_verified = true WHERE id = $2', [passwordHash, userId])
    return { ok: true }
  })
}
