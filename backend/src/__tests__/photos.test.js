'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

function fakeImageService() {
  return {
    processed: [],
    removed: [],
    async process(buf, { plantingId }) {
      const rel = `plantings/${plantingId}/fake-uuid.webp`
      this.processed.push(rel)
      return { file_path: rel, width: 1600, height: 1200, bytes: 12345, taken_at: null }
    },
    async remove(rel) { this.removed.push(rel) }
  }
}

function makeDb({ owns = true, photoCount = 0, accountCount = 0, user = {}, actionMatch = true } = {}) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      if (/FROM plantings p\s+JOIN gardens g/i.test(sql) && /WHERE p\.id/i.test(sql)) {
        return { rows: owns ? [{ '?column?': 1 }] : [] }
      }
      if (/FROM action_logs WHERE id/i.test(sql)) {
        return { rows: actionMatch ? [{ '?column?': 1 }] : [] }
      }
      if (/SELECT subscription_until, promo_until, store FROM users/i.test(sql)) {
        return { rows: [user] }
      }
      if (/COUNT\(\*\).*FROM planting_photos pp\s+JOIN/i.test(sql)) {
        return { rows: [{ count: String(accountCount) }] }
      }
      if (/COUNT\(\*\).*FROM planting_photos WHERE planting_id/i.test(sql)) {
        return { rows: [{ count: String(photoCount) }] }
      }
      if (/INSERT INTO planting_photos/i.test(sql)) {
        const row = { id: 1, planting_id: params[0], action_id: params[1], file_path: params[2] }
        inserted.push(row)
        return { rows: [row] }
      }
      throw new Error('Неожиданный SQL: ' + sql)
    }
  }
}

describe('POST /photos', () => {
  it('happy path: 201, файл обработан, строка вставлена', async () => {
    const img = fakeImageService()
    const db = makeDb({ photoCount: 0, user: { subscription_until: null } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('fakebytes'), 'photo.jpg')
    expect(res.status).toBe(201)
    expect(img.processed).toHaveLength(1)
    expect(db.inserted).toHaveLength(1)
    await app.close()
  })

  it('IDOR: чужая посадка → 403, файл не обработан', async () => {
    const img = fakeImageService()
    const db = makeDb({ owns: false })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(403)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })

  it('квота free (3-е есть → 4-е) → 409 photo_limit_reached', async () => {
    const img = fakeImageService()
    const db = makeDb({ photoCount: 3, user: { subscription_until: null } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('photo_limit_reached')
    expect(res.body.limit).toBe(3)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })

  it('подписчик: лимит 30 (есть 3 → проходит)', async () => {
    const img = fakeImageService()
    const future = new Date(Date.now() + 30 * 86400000)
    const db = makeDb({ photoCount: 3, user: { subscription_until: future } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(201)
    await app.close()
  })

  it('action_id не от этой посадки → 400', async () => {
    const img = fakeImageService()
    const db = makeDb({ actionMatch: false, user: { trial_started_at: new Date() } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .field('action_id', '99')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(400)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })
})

describe('GET /photos', () => {
  it('возвращает фото посадки с url/thumb_url, scoped по владельцу', async () => {
    const db = {
      async query(sql, params) {
        if (/SELECT .* FROM planting_photos pp/i.test(sql) && /g\.user_id = \$1/i.test(sql)) {
          expect(params[0]).toBe(1) // userId из токена
          return { rows: [{ id: 10, planting_id: 5, file_path: 'plantings/5/a.webp', taken_at: '2026-06-01', caption: null, action_id: null, width: 1600, height: 1200 }] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, {})
    const res = await supertest(app.server)
      .get('/photos?planting_id=5')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].url).toBe('/photos/file/10')
    expect(res.body[0].thumb_url).toBe('/photos/file/10?thumb=1')
    expect(res.body[0].file_path).toBeUndefined() // внутренний путь наружу не отдаём
    await app.close()
  })
})

describe('DELETE /photos/:id', () => {
  it('владелец → 204, файл удалён, строка удалена', async () => {
    const img = { removed: [], async remove(rel) { this.removed.push(rel) } }
    const deleted = []
    const db = {
      async query(sql, params) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) {
          return { rows: [{ file_path: 'plantings/5/a.webp' }] }
        }
        if (/DELETE FROM planting_photos WHERE id/i.test(sql)) {
          deleted.push(params[0]); return { rowCount: 1 }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .delete('/photos/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(204)
    expect(img.removed).toEqual(['plantings/5/a.webp'])
    expect(deleted).toEqual([10])
    await app.close()
  })

  it('чужое/несуществующее → 404, файл не трогаем', async () => {
    const img = { removed: [], async remove(rel) { this.removed.push(rel) } }
    const db = {
      async query(sql) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) return { rows: [] }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .delete('/photos/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(404)
    expect(img.removed).toHaveLength(0)
    await app.close()
  })
})

describe('GET /photos/file/:id', () => {
  function db() {
    return {
      async query(sql, params) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) {
          return params[1] === 1 ? { rows: [{ file_path: 'plantings/5/a.webp' }] } : { rows: [] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  it('владелец → 200 + X-Accel-Redirect на основной файл', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.headers['x-accel-redirect']).toBe('/media-internal/plantings/5/a.webp')
    expect(res.headers['content-type']).toContain('image/webp')
    await app.close()
  })

  it('?thumb=1 → X-Accel-Redirect на thumbnail', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10?thumb=1')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.headers['x-accel-redirect']).toBe('/media-internal/plantings/5/a_t.webp')
    await app.close()
  })

  it('чужое → 404', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10')
      .set('Authorization', `Bearer ${makeToken(app, 2)}`)
    expect(res.status).toBe(404)
    await app.close()
  })
})
