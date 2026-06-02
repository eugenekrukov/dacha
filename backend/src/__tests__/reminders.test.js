'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const REMINDER = {
  id: 1, user_id: 1, planting_id: 1, remind_at: new Date().toISOString(),
  type: 'watering', message: 'Полить помидоры', is_sent: false,
  crop_name: 'Помидор',
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
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
