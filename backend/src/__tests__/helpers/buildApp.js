'use strict'

/**
 * Фабрика Fastify-инстанса для интеграционных тестов.
 *
 * Принимает объект `mockDb` — заглушку pg Pool.
 * Каждый тест передаёт свой мок, контролируя что "возвращает БД".
 *
 * Пример:
 *   const app = await buildApp(mockDb)
 *   const res = await supertest(app.server).post('/auth/register').send({ ... })
 */

const Fastify = require('fastify')

async function buildApp(mockDb, billingOpts = {}) {
  const fastify = Fastify({ logger: false })

  // JWT
  fastify.register(require('@fastify/jwt'), { secret: 'test-secret' })

  // Приём файлов (фото-дневник). Лимит на размер файла — 10 МБ.
  fastify.register(require('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } })

  // Подставляем мок-БД вместо реального подключения
  fastify.decorate('db', mockDb)

  // Auth decorator (такой же как в app.js)
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  // Admin guard — зеркало app.js: пускает только request.user.email === ADMIN_EMAIL.
  fastify.decorate('requireAdmin', async function (request, reply) {
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

  // Регистрируем роуты
  fastify.register(require('../../routes/auth'),      { prefix: '/auth' })
  fastify.register(require('../../routes/promo'),     { prefix: '/promo' })
  fastify.register(require('../../routes/billing'),   { prefix: '/billing', ...billingOpts })
  fastify.register(require('../../routes/gardens'),   { prefix: '/gardens' })
  fastify.register(require('../../routes/beds'),     { prefix: '/beds' })
  fastify.register(require('../../routes/guide'),      { prefix: '/guide' })
  fastify.register(require('../../routes/today'),     { prefix: '/today' })
  fastify.register(require('../../routes/actions'),   { prefix: '/actions', imageService: billingOpts.imageService })
  fastify.register(require('../../routes/plantings'), { prefix: '/plantings' })
  fastify.register(require('../../routes/harvests'),  { prefix: '/harvests' })
  fastify.register(require('../../routes/analytics'), { prefix: '/analytics' })
  fastify.register(require('../../routes/reminders'), { prefix: '/reminders' })
  fastify.register(require('../../routes/push-tokens'), { prefix: '/push-tokens' })
  fastify.register(require('../../routes/unsubscribe'), { prefix: '/unsubscribe' })
  fastify.register(require('../../routes/photos'), { prefix: '/photos', imageService: billingOpts.imageService })
  fastify.register(require('../../routes/feed'), { prefix: '/feed' })
  fastify.register(require('../../routes/moon-calendar'), { prefix: '/moon-calendar' })

  await fastify.ready()
  return fastify
}

/**
 * Генерирует валидный JWT для тестового пользователя.
 * Использует тот же secret 'test-secret', что и buildApp.
 */
function makeToken(fastify, userId = 1, email = 'test@test.com') {
  return fastify.jwt.sign({ userId, email })
}

module.exports = { buildApp, makeToken }
