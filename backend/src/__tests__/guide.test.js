'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const ENTRY = {
  id: 1, slug: 'potassium-deficiency', name: 'Недостаток калия', kind: 'deficiency',
  element: 'K', category: 'микроэлемент', danger: 3, symptoms: 'краевой ожог листьев',
  season: 'плодоношение', image_url: null,
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('GET /guide', () => {
  it('возвращает список записей (публично, без токена)', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [ENTRY] }) }))
    const res = await supertest(app.server).get('/guide')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ slug: 'potassium-deficiency', kind: 'deficiency' })
    await app.close()
  })

  it('фильтрует по kind (формирует WHERE e.kind)', async () => {
    let captured = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => { captured = { sql, params }; return { rows: [ENTRY] } },
    }))
    const res = await supertest(app.server).get('/guide?kind=deficiency')
    expect(res.status).toBe(200)
    expect(captured.sql).toContain('e.kind = $1')
    expect(captured.params).toContain('deficiency')
    await app.close()
  })

  it('400 при некорректном kind', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).get('/guide?kind=banana')
    expect(res.status).toBe(400)
    await app.close()
  })

  it('фильтрует по crop_id и поисковому запросу q', async () => {
    let captured = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => { captured = { sql, params }; return { rows: [] } },
    }))
    const res = await supertest(app.server).get('/guide?crop_id=5&q=калий')
    expect(res.status).toBe(200)
    expect(captured.sql).toContain('crop_guide_entries')
    expect(captured.sql).toContain('ILIKE')
    expect(captured.params).toContain(5)
    expect(captured.params).toContain('%калий%')
    await app.close()
  })
})

describe('GET /guide/:slug', () => {
  it('возвращает запись + поражаемые культуры', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM guide_entries WHERE slug')) return { rows: [ENTRY] }
        if (sql.includes('crop_guide_entries')) return { rows: [{ crop_id: 5, crop_name: 'Огурец', signs: 'узкий кончик', image_url: null }] }
        return { rows: [] }
      },
    }))
    const res = await supertest(app.server).get('/guide/potassium-deficiency')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ slug: 'potassium-deficiency' })
    expect(res.body.crops[0]).toMatchObject({ crop_name: 'Огурец', signs: 'узкий кончик' })
    await app.close()
  })

  it('404 для несуществующего slug', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const res = await supertest(app.server).get('/guide/does-not-exist')
    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('POST /guide (admin)', () => {
  const prevAdmin = process.env.ADMIN_EMAIL
  beforeEach(() => { process.env.ADMIN_EMAIL = 'admin@test.com' })
  afterEach(() => { process.env.ADMIN_EMAIL = prevAdmin })

  it('создаёт запись для админа и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => sql.includes('INSERT INTO guide_entries') ? { rows: [ENTRY] } : { rows: [] },
    }))
    const token = makeToken(app, 1, 'admin@test.com')
    const res = await supertest(app.server)
      .post('/guide')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'potassium-deficiency', name: 'Недостаток калия', kind: 'deficiency' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ slug: 'potassium-deficiency' })
    await app.close()
  })

  it('403 для не-админа', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app, 2, 'user@test.com')
    const res = await supertest(app.server)
      .post('/guide')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'x', name: 'X', kind: 'disease' })
    expect(res.status).toBe(403)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/guide').send({ slug: 'x', name: 'X', kind: 'disease' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('400 при некорректном kind', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app, 1, 'admin@test.com')
    const res = await supertest(app.server)
      .post('/guide')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'x', name: 'X', kind: 'banana' })
    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('PUT /guide/:id (admin)', () => {
  const prevAdmin = process.env.ADMIN_EMAIL
  beforeEach(() => { process.env.ADMIN_EMAIL = 'admin@test.com' })
  afterEach(() => { process.env.ADMIN_EMAIL = prevAdmin })

  it('обновляет запись и возвращает 200', async () => {
    const updated = { ...ENTRY, name: 'Калий — обновлено' }
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [updated] }) }))
    const token = makeToken(app, 1, 'admin@test.com')
    const res = await supertest(app.server)
      .put('/guide/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Калий — обновлено' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Калий — обновлено' })
    await app.close()
  })

  it('400 если нечего обновлять', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app, 1, 'admin@test.com')
    const res = await supertest(app.server)
      .put('/guide/1')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    await app.close()
  })
})
