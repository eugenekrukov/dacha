'use strict'

const bcrypt = require('bcrypt')

// Длительность пробного периода (дней). Сервер — источник правды по триалу.
const TRIAL_DAYS = 7

/** Возвращает { trial_active, trial_days_left } по дате старта триала. */
function trialInfo(trialStartedAt) {
  if (!trialStartedAt) return { trial_active: false, trial_days_left: 0 }
  const startMs = new Date(trialStartedAt).getTime()
  const daysSince = Math.floor((Date.now() - startMs) / 86_400_000)
  const daysLeft = Math.max(0, TRIAL_DAYS - daysSince)
  return { trial_active: daysLeft > 0, trial_days_left: daysLeft }
}

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
      'SELECT id, email, name, push_token, notification_settings, created_at, trial_started_at FROM users WHERE id = $1',
      [request.user.userId]
    )
    const user = result.rows[0]
    if (!user) return user
    return { ...user, ...trialInfo(user.trial_started_at) }
  })
}
