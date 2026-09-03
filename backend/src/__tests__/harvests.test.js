'use strict'

const supertest = require('supertest')
const { buildApp, makeToken, freeTierQuery } = require('./helpers/buildApp')

const HARVEST = {
  id: 1, planting_id: 1, weight_kg: 1.5, quantity: 10, notes: null,
  harvested_at: new Date().toISOString(), crop_name: 'Помидор', planted_at: new Date().toISOString(),
}

// Запрос free-набора перехватываем здесь: по умолчанию посадка 1 не заблокирована.
function makeMockDb(overrides = {}) {
  const base = { query: async () => ({ rows: [] }), ...overrides }
  return { ...base, query: async (sql, params) => freeTierQuery(sql) || base.query(sql, params) }
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

  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql) => {
        queries.push(sql)
        return freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'harvesting' }] }
      },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, weight_kg: 1.5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/harvests').send({ planting_id: 1, weight_kg: 1 })
    expect(res.status).toBe(401)
    await app.close()
  })

  // БАГ: у POST /harvests нет schema-валидации body (в отличие от auth/billing/promo) —
  // отрицательный вес/количество урожая проходит на INSERT как есть и попадает в БД
  // и в аналитику урожайности (weight_kg суммируется по grow-графикам в отчётах).
  it('БАГ: отрицательный weight_kg должен отклоняться, а не создавать запись урожая', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ ...HARVEST, weight_kg: -5 }] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, weight_kg: -5 })

    expect(res.status).toBe(400)
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
