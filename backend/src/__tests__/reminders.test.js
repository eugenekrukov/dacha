'use strict'

const supertest = require('supertest')
const { buildApp, makeToken, freeTierQuery } = require('./helpers/buildApp')

const REMINDER = {
  id: 1, user_id: 1, planting_id: 1, remind_at: new Date().toISOString(),
  type: 'watering', message: 'Полить помидоры', is_sent: false,
  crop_name: 'Помидор',
}

// Запрос free-набора перехватываем здесь: по умолчанию посадка 1 не заблокирована.
function makeMockDb(overrides = {}) {
  const base = { query: async () => ({ rows: [] }), ...overrides }
  return { ...base, query: async (sql, params) => freeTierQuery(sql) || base.query(sql, params) }
}

describe('POST /reminders', () => {
  it('создаёт напоминание и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [REMINDER] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, remind_at: new Date().toISOString(), type: 'watering', message: 'Полить' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ type: 'watering' })
    await app.close()
  })

  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql) => {
        queries.push(sql)
        return freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'growing' }] }
      },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, remind_at: new Date().toISOString(), type: 'watering' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/reminders').send({ planting_id: 1, remind_at: new Date(), type: 'watering' })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /reminders', () => {
  it('возвращает только непрочитанные напоминания текущего пользователя', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [REMINDER] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/reminders')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ type: 'watering', is_sent: false })
    await app.close()
  })

  it('возвращает пустой массив если нет напоминаний', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/reminders')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    await app.close()
  })

  it('изоляция — не видит напоминания другого пользователя', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app, 2)

    const res = await supertest(app.server)
      .get('/reminders')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body).toEqual([])
    await app.close()
  })
})
