'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const PLANTING = {
  id: 1, garden_id: 1, crop_id: 1, stage: 'sowing',
  planted_at: new Date().toISOString(), quantity: 1, conditions: 'soil',
  crop_name: 'Помидор', category: 'vegetables', watering_freq_days: 3,
  frost_sensitive: true, harvest_days: 90, care_tasks: null, last_action_at: null,
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('POST /plantings', () => {
  it('создаёт посадку со stage=sowing и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        // Проверка владельца участка проходит
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(201)
    expect(res.body.stage).toBe('sowing')
    await app.close()
  })

  it('403 при создании посадки в чужом участке (IDOR)', async () => {
    // Мок: проверка владельца возвращает пусто → участок не принадлежит пользователю
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 999, crop_id: 1 })

    expect(res.status).toBe(403)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/plantings').send({ garden_id: 1, crop_id: 1 })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /plantings', () => {
  it('возвращает посадки текущего пользователя', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
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
      .get('/plantings?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(capturedSql).toContain('garden_id')
    await app.close()
  })

  it('не содержит care_tasks в ответе (внутреннее поле)', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0]).not.toHaveProperty('care_tasks')
    await app.close()
  })

  it('возвращает next_care_task для каждой посадки', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0]).toHaveProperty('next_care_task')
    await app.close()
  })

  it('для завершённой посадки (stage=done) next_care_task — null, даже если есть будущая care-задача', async () => {
    const donePlanting = {
      ...PLANTING,
      stage: 'done',
      planted_at: new Date().toISOString(),
      care_tasks: [{ name: 'Пасынкование', day_offset: 100, repeat_days: null }],
    }
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [donePlanting] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0].next_care_task).toBeNull()
    expect(res.body[0].overdue_care_task).toBeNull()
    await app.close()
  })
})

describe('GET /plantings/:id', () => {
  it('возвращает посадку по id', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [PLANTING] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1 })
    await app.close()
  })

  it('404 для чужой посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings/99')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('PATCH /plantings/:id/stage', () => {
  it('обновляет стадию посадки', async () => {
    const updated = { ...PLANTING, stage: 'sprouted' }
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [updated] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'sprouted' })

    expect(res.status).toBe(200)
    expect(res.body.stage).toBe('sprouted')
    await app.close()
  })

  it('404 для несуществующей посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/99/stage')
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'sprouted' })

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('DELETE /plantings/:id', () => {
  it('удаляет посадку и возвращает 200', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ id: 1 }] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/plantings/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true })
    await app.close()
  })

  it('404 для чужой посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/plantings/99')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})
