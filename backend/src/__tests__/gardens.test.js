'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const GARDEN = { id: 1, user_id: 1, name: 'Мой участок', lat: 55.75, lon: 37.62, region: 'Москва', soil_type: null, climate_zone: 3 }

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('POST /gardens', () => {
  it('создаёт участок и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT * FROM gardens')) return { rows: [] }
        if (sql.includes('INSERT INTO gardens')) return { rows: [GARDEN] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Мой участок', region: 'Москва' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Мой участок' })
    await app.close()
  })

  it('возвращает 409 если достигнут лимит 3 участка', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT * FROM gardens'))
          return { rows: [GARDEN, { ...GARDEN, id: 2 }, { ...GARDEN, id: 3 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Четвёртый', region: 'Москва' })

    expect(res.status).toBe(409)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/gardens').send({ name: 'Test', region: 'Москва' })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /gardens', () => {
  it('возвращает только участки текущего пользователя', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [GARDEN] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ name: 'Мой участок' })
    await app.close()
  })

  it('возвращает пустой массив если нет участков', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    await app.close()
  })
})

describe('GET /gardens/:id', () => {
  it('возвращает участок по id', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [GARDEN] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1 })
    await app.close()
  })

  it('404 для чужого участка', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/99')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('PUT /gardens/:id', () => {
  it('обновляет участок и возвращает 200', async () => {
    const updated = { ...GARDEN, name: 'Новое имя', soil_type: 'loam' }
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [updated] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .put('/gardens/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Новое имя', region: 'Москва', soil_type: 'loam' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Новое имя', soil_type: 'loam' })
    await app.close()
  })

  it('404 при обновлении чужого участка', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .put('/gardens/99')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', region: 'Москва' })

    expect(res.status).toBe(404)
    await app.close()
  })
})
