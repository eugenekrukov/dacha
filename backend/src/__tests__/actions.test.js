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

  it('сохраняет флаг auto=true при подставленной заметке', async () => {
    let insertParams
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO action_logs')) { insertParams = params; return { rows: [{ ...ACTION, auto: true }] } }
        return { rows: [{ id: 1 }] } // проверка владельца проходит
      },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'loosening', notes: 'Рыхление', auto: true })

    expect(insertParams[3]).toBe(true) // auto — 4-й параметр INSERT
    await app.close()
  })

  it('auto по умолчанию false', async () => {
    let insertParams
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO action_logs')) { insertParams = params; return { rows: [ACTION] } }
        return { rows: [{ id: 1 }] }
      },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'watering' })

    expect(insertParams[3]).toBe(false)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/actions').send({ planting_id: 1, action_type: 'watering' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('передаёт client_id и logged_at в INSERT', async () => {
    let insertParams
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO action_logs')) { insertParams = params; return { rows: [ACTION] } }
        return { rows: [{ id: 1 }] } // владелец найден
      },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planting_id: 1, type: 'watering',
        client_id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-06-20T08:30:00.000Z',
      })

    expect(insertParams[4]).toBe('2026-06-20T08:30:00.000Z') // logged_at — 5-й параметр
    expect(insertParams[5]).toBe('11111111-1111-4111-8111-111111111111') // client_id — 6-й
    await app.close()
  })

  it('при конфликте client_id возвращает существующую строку (идемпотентно)', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        // ON CONFLICT DO UPDATE ... RETURNING * атомарно возвращает существующую строку
        if (sql.includes('INSERT INTO action_logs')) return { rows: [ACTION] }
        return { rows: [{ id: 1 }] }                                          // владелец
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'watering', client_id: '11111111-1111-4111-8111-111111111111' })

    expect(res.status).toBe(201)
    expect(res.body.action_type).toBe('watering')
    await app.close()
  })

  it('кривой client_id → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ id: 1 }] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'watering', client_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
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
