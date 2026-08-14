'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')
const { normalizeExpiry } = require('../routes/seeds')

const ROW = {
  id: 5, crop_name: 'Томат', variety: 'Бычье сердце', expires_on: '2027-12-31',
  created_at: '2026-07-29T10:00:00.000Z', has_photo: false, expired: false, expires_this_year: false
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('normalizeExpiry', () => {
  it('месяц с пакетика → последний день месяца', () => {
    expect(normalizeExpiry('2027-12')).toBe('2027-12-31')
    expect(normalizeExpiry('2028-02')).toBe('2028-02-29') // високосный
    expect(normalizeExpiry('2027-02')).toBe('2027-02-28')
  })

  it('полная дата проходит как есть, пустое значение снимает срок', () => {
    expect(normalizeExpiry('2027-06-15')).toBe('2027-06-15')
    expect(normalizeExpiry(null)).toBeNull()
    expect(normalizeExpiry('')).toBeNull()
  })

  it('мусор и несуществующие даты → undefined', () => {
    expect(normalizeExpiry('12.2027')).toBeUndefined()
    expect(normalizeExpiry('2027-13')).toBeUndefined()
    expect(normalizeExpiry('2027-02-30')).toBeUndefined()
    expect(normalizeExpiry(2027)).toBeUndefined()
  })
})

describe('GET /seeds', () => {
  it('отдаёт коробку пользователя с флагами срока годности', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ ...ROW, has_photo: true, expired: true }] }),
    }))
    const res = await supertest(app.server).get('/seeds').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.status).toBe(200)
    expect(res.body[0].expired).toBe(true)
    expect(res.body[0].thumb_url).toBe('/seeds/5/photo?thumb=1')
    expect(res.body[0].has_photo).toBeUndefined()
    await app.close()
  })

  it('без фото url-ы null', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [ROW] }) }))
    const res = await supertest(app.server).get('/seeds').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.body[0].photo_url).toBeNull()
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    expect((await supertest(app.server).get('/seeds')).status).toBe(401)
    await app.close()
  })
})

describe('POST /seeds', () => {
  it('создаёт пакетик и нормализует месяц в дату', async () => {
    let inserted = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('COUNT(*)')) return { rows: [{ count: '3' }] }
        if (sql.includes('INSERT INTO seeds')) { inserted = params; return { rows: [{ id: 5 }] } }
        return { rows: [ROW] }
      },
    }))
    const res = await supertest(app.server)
      .post('/seeds').set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ crop_name: '  Томат ', variety: 'Бычье сердце', expires_on: '2027-12' })

    expect(res.status).toBe(201)
    expect(inserted[1]).toBe('Томат')       // тримим ввод
    expect(inserted[3]).toBe('2027-12-31')
    await app.close()
  })

  it('400 без культуры и 400 на кривом сроке', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ count: '0' }] }) }))
    const token = makeToken(app)

    const noName = await supertest(app.server).post('/seeds').set('Authorization', `Bearer ${token}`).send({ variety: 'X' })
    expect(noName.status).toBe(400)

    const badDate = await supertest(app.server).post('/seeds').set('Authorization', `Bearer ${token}`)
      .send({ crop_name: 'Томат', expires_on: '12.2027' })
    expect(badDate.status).toBe(400)
    await app.close()
  })

  it('409 при исчерпании потолка записей', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ count: '200' }] }) }))
    const res = await supertest(app.server)
      .post('/seeds').set('Authorization', `Bearer ${makeToken(app)}`).send({ crop_name: 'Томат' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('seeds_cap_reached')
    await app.close()
  })
})

describe('PATCH /seeds/:id', () => {
  it('снимает срок годности при expires_on: null', async () => {
    let params = null
    const app = await buildApp(makeMockDb({
      query: async (sql, p) => {
        if (sql.includes('UPDATE seeds')) { params = p; return { rows: [{ id: 5 }] } }
        return { rows: [{ ...ROW, expires_on: null }] }
      },
    }))
    const res = await supertest(app.server)
      .patch('/seeds/5').set('Authorization', `Bearer ${makeToken(app)}`).send({ expires_on: null })

    expect(res.status).toBe(200)
    expect(params[3]).toBe(true)   // флаг «трогаем expires_on»
    expect(params[4]).toBeNull()
    expect(res.body.expires_on).toBeNull()
    await app.close()
  })

  it('не трогает поля, которых нет в теле', async () => {
    let params = null
    const app = await buildApp(makeMockDb({
      query: async (sql, p) => {
        if (sql.includes('UPDATE seeds')) { params = p; return { rows: [{ id: 5 }] } }
        return { rows: [ROW] }
      },
    }))
    await supertest(app.server)
      .patch('/seeds/5').set('Authorization', `Bearer ${makeToken(app)}`).send({ crop_name: 'Огурец' })

    expect(params[1]).toBe(false)  // variety не трогаем
    expect(params[3]).toBe(false)  // expires_on не трогаем
    await app.close()
  })

  it('404 для чужого пакетика', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const res = await supertest(app.server)
      .patch('/seeds/999').set('Authorization', `Bearer ${makeToken(app)}`).send({ crop_name: 'Чужой' })

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('DELETE /seeds/:id', () => {
  it('удаляет запись вместе с файлами фото', async () => {
    const removed = []
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ photo_path: 'seeds/1/abc.webp' }] }),
    }), { imageService: { remove: async (p) => removed.push(p) } })
    const res = await supertest(app.server).delete('/seeds/5').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.status).toBe(204)
    expect(removed).toEqual(['seeds/1/abc.webp'])
    await app.close()
  })

  it('404 для чужого пакетика', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    expect((await supertest(app.server).delete('/seeds/5').set('Authorization', `Bearer ${makeToken(app)}`)).status).toBe(404)
    await app.close()
  })
})

describe('POST /seeds/:id/photo', () => {
  it('кладёт фото в каталог пользователя и убирает прежний файл', async () => {
    const removed = []
    let savedPath = null
    const imageService = {
      process: async (_buf, opts) => {
        expect(opts.dir).toBe('seeds/1')
        return { file_path: 'seeds/1/new.webp', width: 800, height: 600, bytes: 1234, taken_at: null }
      },
      remove: async (p) => removed.push(p),
      thumbPath: (p) => p.replace('.webp', '_t.webp'),
    }
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE seeds')) { savedPath = params[0]; return { rows: [] } }
        if (sql.startsWith('SELECT photo_path')) return { rows: [{ photo_path: 'seeds/1/old.webp' }] }
        return { rows: [{ ...ROW, has_photo: true }] }
      },
    }), { imageService })

    const res = await supertest(app.server)
      .post('/seeds/5/photo').set('Authorization', `Bearer ${makeToken(app)}`)
      .attach('file', Buffer.from('fake-jpeg'), 'packet.jpg')

    expect(res.status).toBe(201)
    expect(savedPath).toBe('seeds/1/new.webp')
    expect(removed).toEqual(['seeds/1/old.webp'])
    expect(res.body.photo_url).toBe('/seeds/5/photo')
    await app.close()
  })

  it('404 для чужого пакетика', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const res = await supertest(app.server)
      .post('/seeds/5/photo').set('Authorization', `Bearer ${makeToken(app)}`)
      .attach('file', Buffer.from('fake'), 'p.jpg')

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('GET /seeds/:id/photo', () => {
  it('отдаёт thumbnail через X-Accel-Redirect', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ photo_path: 'seeds/1/abc.webp' }] }),
    }), { imageService: { thumbPath: (p) => p.replace('.webp', '_t.webp') } })

    const res = await supertest(app.server)
      .get('/seeds/5/photo?thumb=1').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.headers['x-accel-redirect']).toBe('/media-internal/seeds/1/abc_t.webp')
    await app.close()
  })

  it('404 если фото не загружено', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ photo_path: null }] }) }))
    const res = await supertest(app.server).get('/seeds/5/photo').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('GET /seeds/shopping-list', () => {
  it('отдаёт культуры активных посадок без непросроченных семян', async () => {
    const queries = []
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        queries.push({ sql, params })
        return { rows: [{ crop_id: 3, crop_name: 'Морковь' }, { crop_id: 7, crop_name: 'Свёкла' }] }
      },
    }))
    const res = await supertest(app.server)
      .get('/seeds/shopping-list').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([{ crop_id: 3, crop_name: 'Морковь' }, { crop_id: 7, crop_name: 'Свёкла' }])
    expect(queries[0].sql).toMatch(/p\.stage <> 'done'/)
    expect(queries[0].sql).toMatch(/NOT EXISTS/)
    await app.close()
  })

  it('пустой список, если всё укомплектовано', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const res = await supertest(app.server)
      .get('/seeds/shopping-list').set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.body).toEqual([])
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).get('/seeds/shopping-list')
    expect(res.status).toBe(401)
    await app.close()
  })
})
