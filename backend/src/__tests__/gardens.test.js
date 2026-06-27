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

describe('GET /gardens/:id/beds', () => {
  it('возвращает грядки участка с историей посадок за 3 года', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM gardens')) return { rows: [{ id: 1 }] }
        if (sql.includes('FROM garden_beds')) {
          return { rows: [{ id: 10, name: 'Теплица 1', type: 'greenhouse', history: [
            { crop_name: 'Томат', family: 'Паслёновые', year: 2025 },
          ] }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/1/beds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body[0]).toMatchObject({ name: 'Теплица 1' })
    expect(res.body[0].history[0]).toMatchObject({ crop_name: 'Томат', family: 'Паслёновые' })
    await app.close()
  })

  it('404 для чужого участка', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/999/beds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('POST /gardens/:id/beds', () => {
  it('создаёт грядку в своём участке', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM gardens')) return { rows: [{ id: 1 }] }
        if (sql.includes('INSERT INTO garden_beds')) return { rows: [{ id: 10, garden_id: 1, name: 'Грядка 1', type: 'soil' }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens/1/beds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка 1', type: 'soil' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Грядка 1', history: [] })
    await app.close()
  })

  it('403/404 при создании грядки в чужом участке', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens/999/beds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка', type: 'soil' })

    expect(res.status).toBe(404)
    await app.close()
  })
})
