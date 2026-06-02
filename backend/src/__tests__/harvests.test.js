'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const HARVEST = {
  id: 1, planting_id: 1, weight_kg: 1.5, quantity: 10, notes: null,
  harvested_at: new Date().toISOString(), crop_name: 'Помидор', planted_at: new Date().toISOString(),
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('POST /harvests', () => {
  it('создаёт запись урожая и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [HARVEST] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, weight_kg: 1.5, quantity: 10 })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ weight_kg: 1.5, quantity: 10 })
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/harvests').send({ planting_id: 1, weight_kg: 1 })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /harvests', () => {
  it('возвращает урожай текущего пользователя с crop_name', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [HARVEST] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/harvests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ crop_name: 'Помидор' })
    await app.close()
  })

  it('фильтрует по garden_id', async () => {
    let capturedSql = ''
    const app = await buildApp(makeMockDb({
      query: async (sql) => { capturedSql = sql; return { rows: [] } },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .get('/harvests?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(capturedSql).toContain('g.id=$2')
    await app.close()
  })

  it('изоляция по user_id — не видит чужой урожай', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app, 2)

    const res = await supertest(app.server)
      .get('/harvests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body).toEqual([])
    await app.close()
  })
})
