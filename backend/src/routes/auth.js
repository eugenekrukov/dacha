'use strict'

const bcrypt = require('bcrypt')
const { isSubscribed, hasPromo, isLifetimePromo, isAdSupportedStore, SUBSCRIPTION_WINDOW_DAYS, FREE_PLANTING_LIMIT } = require('../utils/access')
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
          name:     { type: 'string' },   // опционально (имя больше не собирается клиентом)
          store:    { type: 'string', enum: ['rustore', 'gplay', 'samsung', 'web'] }  // магазин установки (E5); web — браузерная версия
        }
      }
    }
  }, async (request, reply) => {
    const email = request.body.email.toLowerCase()
    const { password, name, store } = request.body
    const db = fastify.db

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return reply.code(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, store) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at, email_verified',
      [email, passwordHash, name ?? null, store ?? null]
    )

    const user = result.rows[0]
    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

    // Отправляем код подтверждения email (best-effort, НЕ блокируя ответ — почта уходит
    // в фоне, чтобы запрос не висел при недоступности почтового сервиса).
    try {
      const code = await issueCode(db, user.id, 'verify')
      sendVerificationCode(user.email, code).catch(e =>
        fastify.log.warn(`[auth] не удалось отправить код подтверждения: ${e.message}`))
    } catch (e) {
      fastify.log.warn(`[auth] issueCode (verify) failed: ${e.message}`)
    }

    return reply.code(201).send({ token, user: { ...user, plantings_limit: FREE_PLANTING_LIMIT } })
  })

  // POST /auth/login
  // keyGenerator по email (а не только IP по умолчанию) — иначе перебор пароля одной жертвы
  // можно распределить по множеству IP/проксям и не упереться в лимит.
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => (req.body && req.body.email ? `login:${String(req.body.email).toLowerCase()}` : req.ip)
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
          store:    { type: 'string', enum: ['rustore', 'gplay', 'samsung', 'web'] }  // магазин установки (E5); web — браузерная версия
        }
      }
    }
  }, async (request, reply) => {
    const email = request.body.email.toLowerCase()
    const { password, store } = request.body
    const db = fastify.db

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    // Клиент сообщает магазин установки при каждом входе — фиксируем/обновляем для модели монетизации.
    // НО: право на бесплатный доступ выводится из store (samsung — рекламный магазин, доступ без
    // гейта оплаты), а store — клиентское поле. Поэтому НЕ даём клиенту повысить себя до рекламного
    // магазина через login: иначе любой аккаунт, прислав store:'samsung', получил бы бесплатный
    // доступ в обход оплаты. Разрешаем менять store, только если новое значение НЕ даёт бесплатный
    // доступ, либо аккаунт уже был на рекламном магазине (переключение между магазинами — ок).
    if (store && store !== user.store && (!isAdSupportedStore(store) || isAdSupportedStore(user.store))) {
      await db.query('UPDATE users SET store = $1 WHERE id = $2', [store, user.id])
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

    return { token, user: { id: user.id, email: user.email, name: user.name } }
  })

  // GET /auth/me
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request) => {
    const result = await fastify.db.query(
      'SELECT id, email, name, push_token, notification_settings, created_at, subscription_until, promo_until, email_verified, auto_renew, plan, payment_method_id, pending_email FROM users WHERE id = $1',
      [request.user.userId]
    )
    const user = result.rows[0]
    if (!user) return user
    // payment_method_id наружу не отдаём (внутренний токен карты) — только факт наличия карты.
    const { payment_method_id, ...safe } = user
    return {
      ...safe,
      subscribed: isSubscribed(user.subscription_until),
      subscription_until: isSubscribed(user.subscription_until) ? user.subscription_until : null,
      auto_renew: !!user.auto_renew,
      has_saved_card: !!payment_method_id,
      promo_active: hasPromo(user.promo_until),
      promo_lifetime: isLifetimePromo(user.promo_until),
      promo_until: hasPromo(user.promo_until) ? user.promo_until : null,
      plantings_limit: FREE_PLANTING_LIMIT
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
        sendVerificationCode(user.email, code).catch(e =>
          fastify.log.warn(`[auth] resend-verification send: ${e.message}`))
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
    const email = request.body.email.toLowerCase()
    const res = await db.query('SELECT id FROM users WHERE email = $1', [email])
    if (res.rows.length > 0) {
      try {
        const code = await issueCode(db, res.rows[0].id, 'reset')
        sendPasswordResetCode(email, code).catch(e =>
          fastify.log.warn(`[auth] forgot-password send: ${e.message}`))
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
    const { code, password } = request.body
    const email = request.body.email.toLowerCase()
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

  // PATCH /auth/password — смена пароля залогиненным (нужно знать текущий).
  fastify.patch('/password', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['current_password', 'new_password'],
        properties: {
          current_password: { type: 'string' },
          new_password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [request.user.userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(request.body.current_password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    const hash = await bcrypt.hash(request.body.new_password, 10)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, request.user.userId])
    return { ok: true }
  })

  // POST /auth/change-email — шаг 1: проверка пароля, запись pending_email, код на новый адрес.
  fastify.post('/change-email', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['new_email', 'password'],
        properties: {
          new_email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const { password } = request.body
    const new_email = request.body.new_email.toLowerCase()
    const r = await db.query('SELECT email, password_hash FROM users WHERE id = $1', [request.user.userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    if (new_email === user.email.toLowerCase()) {
      return reply.code(409).send({ error: 'email_taken' })
    }
    const taken = await db.query('SELECT id FROM users WHERE email = $1', [new_email])
    if (taken.rows.length > 0) {
      return reply.code(409).send({ error: 'email_taken' })
    }
    await db.query('UPDATE users SET pending_email = $1 WHERE id = $2', [new_email, request.user.userId])
    try {
      const code = await issueCode(db, request.user.userId, 'change_email')
      sendVerificationCode(new_email, code).catch(e =>
        fastify.log.warn(`[auth] change-email send: ${e.message}`))
    } catch (e) {
      fastify.log.warn(`[auth] change-email issueCode: ${e.message}`)
    }
    return { ok: true }
  })

  // POST /auth/confirm-email-change — шаг 2: код из письма на новый адрес → переключение email.
  fastify.post('/confirm-email-change', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } }
  }, async (request, reply) => {
    const db = fastify.db
    const userId = request.user.userId
    const codeId = await findValidCode(db, userId, 'change_email', request.body.code)
    if (codeId === null) return reply.code(400).send({ error: 'invalid_or_expired_code' })

    const r = await db.query('SELECT pending_email FROM users WHERE id = $1', [userId])
    const pending = r.rows[0]?.pending_email
    if (!pending) return reply.code(400).send({ error: 'no_pending_email' })

    const taken = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [pending, userId])
    if (taken.rows.length > 0) return reply.code(409).send({ error: 'email_taken' })

    await db.query('UPDATE email_codes SET used_at = NOW() WHERE id = $1', [codeId])
    await db.query(
      'UPDATE users SET email = pending_email, pending_email = NULL, email_verified = true WHERE id = $1',
      [userId]
    )
    return { email: pending }
  })

  // DELETE /auth/me — удаление аккаунта. Каскад через FK; payments сохраняем (анонимизация).
  fastify.delete('/me', {
    onRequest: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['password'], properties: { password: { type: 'string' } } } }
  }, async (request, reply) => {
    const db = fastify.db
    const userId = request.user.userId
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(request.body.password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    await db.query('UPDATE payments SET user_id = NULL WHERE user_id = $1', [userId])
    await db.query('DELETE FROM users WHERE id = $1', [userId])
    return { ok: true }
  })
}
