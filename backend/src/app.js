'use strict'

require('dotenv').config()

const Fastify = require('fastify')

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
  }
})

// Plugins
app.register(require('@fastify/cors'), {
  origin: true
})

app.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
})

// DB connection
app.register(require('./plugins/db'))

// Auth decorator
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})


// Admin guard decorator
app.decorate('requireAdmin', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.send(err)
  }
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || request.user.email !== adminEmail) {
    return reply.code(403).send({ error: 'Forbidden: admin only' })
  }
})
// Routes
app.register(require('./routes/auth'), { prefix: '/auth' })
app.register(require('./routes/gardens'), { prefix: '/gardens' })
app.register(require('./routes/crops'), { prefix: '/crops' })
app.register(require('./routes/plantings'), { prefix: '/plantings' })
app.register(require('./routes/actions'), { prefix: '/actions' })
app.register(require('./routes/weather'), { prefix: '/weather' })
app.register(require('./routes/recommendations'), { prefix: '/recommendations' })
app.register(require('./routes/reminders'), { prefix: '/reminders' })
app.register(require('./routes/harvests'), { prefix: '/harvests' })
app.register(require('./routes/today'), { prefix: '/today' })
app.register(require('./routes/push-tokens'), { prefix: '/push-tokens' })
app.register(require('./routes/analytics'), { prefix: '/analytics' })

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Weather background job — стартует после инициализации БД
const { startWeatherJob } = require('./jobs/weatherJob')
app.addHook('onReady', async () => {
  startWeatherJob(app.db)
})

// Start
const start = async () => {
  try {
    const port = parseInt(process.env.PORT) || 3002
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Dacha Calendar API running on port ${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

