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

async function buildApp(mockDb) {
  const fastify = Fastify({ logger: false })

  // JWT
  fastify.register(require('@fastify/jwt'), { secret: 'test-secret' })

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

  // Гейт доступа: в общих тестах — мягкий (только jwtVerify), чтобы не требовать
  // подставлять триал в каждый мок. Логика доступа покрыта в access.test.js.
  fastify.decorate('requireAccess', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  // Регистрируем роуты
  fastify.register(require('../../routes/auth'),      { prefix: '/auth' })
  fastify.register(require('../../routes/promo'),     { prefix: '/promo' })
  fastify.register(require('../../routes/gardens'),   { prefix: '/gardens' })
  fastify.register(require('../../routes/today'),     { prefix: '/today' })
  fastify.register(require('../../routes/actions'),   { prefix: '/actions' })
  fastify.register(require('../../routes/plantings'), { prefix: '/plantings' })
  fastify.register(require('../../routes/harvests'),  { prefix: '/harvests' })
  fastify.register(require('../../routes/analytics'), { prefix: '/analytics' })
  fastify.register(require('../../routes/reminders'), { prefix: '/reminders' })

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
