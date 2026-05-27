'use strict'

const bcrypt = require('bcrypt')

module.exports = async function (fastify) {
  // POST /auth/register
  fastify.post('/register', {
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
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, passwordHash, name]
    )

    const user = result.rows[0]
    const token = fastify.jwt.sign({ userId: user.id, email: user.email })

    return reply.code(201).send({ token, user })
  })

  // POST /auth/login
  fastify.post('/login', {
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
      'SELECT id, email, name, push_token, notification_settings, created_at FROM users WHERE id = $1',
      [request.user.userId]
    )
    return result.rows[0]
  })
}
