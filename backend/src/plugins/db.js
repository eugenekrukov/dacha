'use strict'

const fp = require('fastify-plugin')
const { Pool } = require('pg')

async function dbPlugin(fastify) {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'dacha_db',
    user:     process.env.DB_USER     || 'dacha_user',
    password: process.env.DB_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000
  })

  // Test connection
  try {
    const client = await pool.connect()
    fastify.log.info('PostgreSQL connected')
    client.release()
  } catch (err) {
    fastify.log.error('PostgreSQL connection failed:', err.message)
    throw err
  }

  fastify.decorate('db', pool)

  fastify.addHook('onClose', async () => {
    await pool.end()
  })
}

module.exports = fp(dbPlugin)
