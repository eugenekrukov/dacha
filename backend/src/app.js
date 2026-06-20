'use strict'

require('dotenv').config()

const Fastify = require('fastify')

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
  }
})

// JWT-секрет обязателен в production — иначе токены подделываются предсказуемым ключом
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  app.log.error('JWT_SECRET must be set in production')
  process.exit(1)
}

// Security headers
app.register(require('@fastify/helmet'), { global: true })

// CORS: по умолчанию разрешаем любой origin (мобильный клиент CORS не использует),
// но можно ограничить через переменную CORS_ORIGIN (список через запятую)
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true
app.register(require('@fastify/cors'), {
  origin: corsOrigin
})

// Глобальный rate-limit (защита от перебора/злоупотреблений)
app.register(require('@fastify/rate-limit'), {
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute'
})

app.register(require('@fastify/jwt'), {
  secret: jwtSecret || 'dev-secret-change-in-production',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
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

// Access guard: платные действия доступны при активном триале ИЛИ активной подписке.
// Триал — серверный (users.trial_started_at); подписка — серверное окно (users.subscription_until),
// которое клиент продлевает синхронизацией POST /auth/subscription. 402 при отсутствии доступа.
const { hasAccess } = require('./utils/access')
app.decorate('requireAccess', async function (request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.send(err)
  }
  const res = await app.db.query(
    'SELECT trial_started_at, subscription_until, promo_until, store FROM users WHERE id = $1',
    [request.user.userId]
  )
  if (!hasAccess(res.rows[0])) {
    return reply.code(402).send({ error: 'subscription_required' })
  }
})
// Routes
app.register(require('./routes/auth'), { prefix: '/auth' })
app.register(require('./routes/promo'), { prefix: '/promo' })
app.register(require('./routes/billing'), { prefix: '/billing' })
app.register(require('./routes/gardens'), { prefix: '/gardens' })
app.register(require('./routes/crops'), { prefix: '/crops' })
app.register(require('./routes/guide'), { prefix: '/guide' })
app.register(require('./routes/plantings'), { prefix: '/plantings' })
app.register(require('./routes/actions'), { prefix: '/actions' })
app.register(require('./routes/weather'), { prefix: '/weather' })
app.register(require('./routes/recommendations'), { prefix: '/recommendations' })
app.register(require('./routes/reminders'), { prefix: '/reminders' })
app.register(require('./routes/harvests'), { prefix: '/harvests' })
app.register(require('./routes/today'), { prefix: '/today' })
app.register(require('./routes/push-tokens'), { prefix: '/push-tokens' })
app.register(require('./routes/analytics'), { prefix: '/analytics' })
app.register(require('./routes/geocode'), { prefix: '/geocode' })
app.register(require('./routes/unsubscribe'), { prefix: '/unsubscribe' })

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Background jobs — стартуют после инициализации БД
const { startWeatherJob } = require('./jobs/weatherJob')
const { startCareRemindersJob } = require('./jobs/careRemindersJob')
const { startRenewalJob } = require('./jobs/renewalJob')
const { startNalogJob } = require('./jobs/nalogJob')
const { startTrialEmailsJob } = require('./jobs/trialEmailsJob')
app.addHook('onReady', async () => {
  startWeatherJob(app.db)
  startCareRemindersJob(app.db)
  startRenewalJob(app.db)
  startNalogJob(app.db)
  startTrialEmailsJob(app.db)
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
