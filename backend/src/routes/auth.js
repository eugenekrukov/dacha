'use strict'

const bcrypt = require('bcrypt')
const { trialInfo, isSubscribed, hasPromo, isLifetimePromo, SUBSCRIPTION_WINDOW_DAYS } = require('../utils/access')

module.exports = async function (fastify) {
  // POST /auth/register
  fastify.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name:     { type: 'string' }
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
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at, trial_started_at',
      [email, passwordHash, name]
    )

    const user = result.rows[0]
    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

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
      'SELECT id, email, name, push_token, notification_settings, created_at, trial_started_at, subscription_until, promo_until FROM users WHERE id = $1',
      [request.user.userId]
    )
    const user = result.rows[0]
    if (!user) return user
    return {
      ...user,
      ...trialInfo(user.trial_started_at),
      subscribed: isSubscribed(user.subscription_until),
      promo_active: hasPromo(user.promo_until),
      promo_lifetime: isLifetimePromo(user.promo_until)
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
}
