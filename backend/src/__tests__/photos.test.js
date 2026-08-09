'use strict'

const supertest = require('supertest')
const { buildApp, makeToken, freeTierQuery } = require('./helpers/buildApp')

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

function makeDb({ owns = true, photoCount = 0, accountCount = 0, actionMatch = true,
                 subscribed = false, freeIds = [5], stage = 'growing' } = {}) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      const ft = freeTierQuery(sql, { subscribed, freeIds })
      if (ft) return ft
      if (/FROM plantings p\s+JOIN gardens g/i.test(sql) && /WHERE p\.id/i.test(sql)) {
        return { rows: owns ? [{ id: 5, stage }] : [] }
      }
      if (/FROM action_logs WHERE id/i.test(sql)) {
        return { rows: actionMatch ? [{ '?column?': 1 }] : [] }
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
    const db = makeDb({ photoCount: 0 })
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
    const db = makeDb({ photoCount: 3 })
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
    const db = makeDb({ photoCount: 3, subscribed: true })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(201)
    await app.close()
  })

  it('заблокированная посадка (сверх free-набора, без подписки) → 402, файл не обработан', async () => {
    const img = fakeImageService()
    const db = makeDb({ freeIds: [1, 2, 3] })   // посадка 5 вне свободного набора
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(img.processed).toHaveLength(0)
    await app.close()
  })

  it('action_id не от этой посадки → 400', async () => {
    const img = fakeImageService()
    const db = makeDb({ actionMatch: false })
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

describe('POST /photos/:id/diagnose', () => {
  function makeDiagDb({ owns = true, subscribed = true, cropId = 3, cropName = 'Томат',
                        filePath = 'plantings/5/uuid.webp', freeIds = [], usedCount = 0 } = {}) {
    return {
      async query(sql, params) {
        const ft = freeTierQuery(sql, { subscribed, freeIds })
        if (ft) return ft
        if (/COUNT\(\*\).*FROM planting_photos pp.*WHERE g\.user_id = \$1 AND pp\.ai_diagnosis IS NOT NULL/is.test(sql)) {
          return { rows: [{ count: String(usedCount) }] }
        }
        if (/SELECT pp\.file_path, pp\.planting_id, p\.crop_id, c\.name AS crop_name/i.test(sql)) {
          return { rows: owns ? [{ file_path: filePath, planting_id: 5, crop_id: cropId, crop_name: cropName }] : [] }
        }
        if (/FROM guide_entries e\s+JOIN crop_guide_entries/i.test(sql)) {
          return { rows: [
            { id: 8, name: 'Фитофтороз', kind: 'disease' },
            { id: 61, name: 'Вершинная гниль', kind: 'disease' }
          ] }
        }
        if (/UPDATE planting_photos SET ai_diagnosis/i.test(sql)) {
          return { rows: [{ id: params[2], ai_diagnosis: JSON.parse(params[0]), ai_diagnosed_at: params[1] }] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  function fakeAiService(overrides = {}) {
    return {
      isEnabled: () => true,
      diagnose: async () => ({
        candidates: [{ id: 8, name: 'Фитофтороз', confidence: 'high', reasoning: 'тест' }],
        model: 'qwen-vl-plus'
      }),
      ...overrides
    }
  }

  function fakeFs() {
    return { readFile: async () => Buffer.from('fake-webp-bytes') }
  }

  it('happy path: 200, диагноз записан', async () => {
    const db = makeDiagDb()
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService(), fsPromises: fakeFs() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.body.candidates).toHaveLength(1)
    expect(res.body.disclaimer).toMatch(/предварительн/i)
    await app.close()
  })

  it('без подписки, но лимит бесплатных проверок не исчерпан → 200 (free-хук)', async () => {
    const db = makeDiagDb({ subscribed: false, usedCount: 2 })
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService(), fsPromises: fakeFs() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    await app.close()
  })

  it('без подписки и лимит (3) исчерпан → 402 ai_diagnosis_free_limit_reached', async () => {
    const db = makeDiagDb({ subscribed: false, usedCount: 3 })
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('ai_diagnosis_free_limit_reached')
    expect(res.body.limit).toBe(3)
    await app.close()
  })

  it('чужое фото → 404', async () => {
    const db = makeDiagDb({ owns: false })
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(404)
    await app.close()
  })

  it('сервис выключен (нет ключа) → 503', async () => {
    const db = makeDiagDb()
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService({ isEnabled: () => false }) })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(503)
    await app.close()
  })

  it('файл фото отсутствует на диске → 500, путь в ответе не светится', async () => {
    const db = makeDiagDb()
    const brokenFs = { readFile: async () => { throw new Error('ENOENT: /var/www/dacha-media/plantings/5/uuid.webp') } }
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService(), fsPromises: brokenFs })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'photo_file_missing' })
    expect(res.text).not.toMatch(/\/var\/www|dacha-media/)
    await app.close()
  })
})
