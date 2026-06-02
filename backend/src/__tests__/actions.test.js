'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const ACTION = {
  id: 1, planting_id: 1, action_type: 'watering', notes: null,
  logged_at: new Date().toISOString(), crop_name: 'Помидор',
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('POST /actions', () => {
  it('логирует действие и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [ACTION] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, action_type: 'watering' })

    expect(res.status).toBe(201)
    expect(res.body.action_type).toBe('watering')
    await app.close()
  })

  it('принимает поле type как псевдоним action_type', async () => {
    let capturedParams
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        capturedParams = params
        return { rows: [ACTION] }
      },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'fertilizing' })

    expect(capturedParams[1]).toBe('fertilizing')
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/actions').send({ planting_id: 1, action_type: 'watering' })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /actions', () => {
  it('возвращает действия текущего пользователя', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [ACTION] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/actions')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ action_type: 'watering' })
    await app.close()
  })

  it('фильтрует по planting_id', async () => {
    let capturedSql = ''
    const app = await buildApp(makeMockDb({
      query: async (sql) => { capturedSql = sql; return { rows: [] } },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .get('/actions?planting_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(capturedSql).toContain('planting_id')
    await app.close()
  })

  it('не возвращает действия по чужим посадкам (изоляция по user_id)', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app, 2)  // другой пользователь

    const res = await supertest(app.server)
      .get('/actions')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body).toEqual([])
    await app.close()
  })
})
