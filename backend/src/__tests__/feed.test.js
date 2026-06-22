'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// Строки в том виде, в каком их отдаёт UNION-запрос: { type, ts, data(json) }.
// Запись-центричная модель: action (действие + заметка + агрегированные фото) | photo | milestone.
const ACTION_ROW = {
  type: 'action',
  ts: '2026-06-22T10:00:00.000Z',
  data: {
    action_id: 3, action_type: 'watering', note: 'полил обильно',
    planting_id: 1, crop_name: 'Томат',
    photos: [{ photo_id: 7 }, { photo_id: 8 }],
  },
}
const ACTION_NO_PHOTO_ROW = {
  type: 'action',
  ts: '2026-06-21T09:00:00.000Z',
  data: {
    action_id: 5, action_type: 'fertilizing', note: 'азофоска',
    planting_id: 1, crop_name: 'Томат', photos: [],
  },
}
const PHOTO_ROW = {
  type: 'photo',
  ts: '2026-06-20T10:00:00.000Z',
  data: { photo_id: 9, planting_id: 1, crop_name: 'Томат', caption: 'первый лист' },
}
const HARVEST_ROW = {
  type: 'milestone',
  ts: '2026-06-19T08:00:00.000Z',
  data: { kind: 'first_harvest', planting_id: 2, crop_name: 'Клубника', weight_kg: '0.40' },
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('GET /feed', () => {
  it('маппит action: достраивает url/thumb_url каждому фото, сохраняет заметку', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [ACTION_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      type: 'action', date: ACTION_ROW.ts, action_id: 3, action_type: 'watering',
      note: 'полил обильно', planting_id: 1, crop_name: 'Томат',
    })
    expect(res.body.items[0].photos).toEqual([
      { photo_id: 7, url: '/photos/file/7', thumb_url: '/photos/file/7?thumb=1' },
      { photo_id: 8, url: '/photos/file/8', thumb_url: '/photos/file/8?thumb=1' },
    ])
    await app.close()
  })

  it('action без фото: photos = [] (заметочная запись)', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [ACTION_NO_PHOTO_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.body.items[0]).toMatchObject({ type: 'action', action_id: 5, note: 'азофоска' })
    expect(res.body.items[0].photos).toEqual([])
    await app.close()
  })

  it('маппит одиночное фото: достраивает url/thumb_url и плоскую форму', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [PHOTO_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.body.items[0]).toMatchObject({
      type: 'photo', date: PHOTO_ROW.ts, photo_id: 9, planting_id: 1, crop_name: 'Томат',
      caption: 'первый лист', url: '/photos/file/9', thumb_url: '/photos/file/9?thumb=1',
    })
    await app.close()
  })

  it('нормализует weight_kg вехи «первый урожай» в число', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [HARVEST_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.body.items[0]).toMatchObject({ type: 'milestone', kind: 'first_harvest', weight_kg: 0.4 })
    await app.close()
  })

  it('глобальная лента: action показывается только с фото или ручной заметкой', async () => {
    // Контракт фильтра живёт в SQL — проверяем, что запрос его содержит.
    let capturedSql = null
    const app = await buildApp(makeMockDb({
      query: async (sql) => { capturedSql = sql; return { rows: [] } },
    }))
    const token = makeToken(app)

    await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    // action-ветка отфильтрована: есть привязанное фото ИЛИ ручная непустая заметка (не auto).
    expect(capturedSql).toMatch(/pp\.action_id = al\.id/)
    expect(capturedSql).toMatch(/al\.auto = false/)
    // веха transplanted убрана (высадка теперь обычное действие).
    expect(capturedSql).not.toMatch(/transplanted/)
    await app.close()
  })

  it('изоляция по владельцу — запрос фильтрует по user_id ($1)', async () => {
    let capturedArgs = null
    const app = await buildApp(makeMockDb({
      query: async (sql, args) => { capturedArgs = { sql, args }; return { rows: [] } },
    }))
    const token = makeToken(app, 42)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.body.items).toEqual([])
    expect(capturedArgs.sql).toContain('g.user_id = $1')
    expect(capturedArgs.args[0]).toBe(42)
    await app.close()
  })

  it('пагинация: next_offset = offset+limit когда страница заполнена', async () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({ ...PHOTO_ROW, data: { ...PHOTO_ROW.data, photo_id: i } }))
    let capturedArgs = null
    const app = await buildApp(makeMockDb({
      query: async (sql, args) => { capturedArgs = args; return { rows } },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed?limit=2&offset=4').set('Authorization', `Bearer ${token}`)

    expect(capturedArgs).toEqual([1, 2, 4]) // [userId, limit, offset]
    expect(res.body.next_offset).toBe(6)
    await app.close()
  })

  it('пагинация: next_offset = null на неполной странице (конец ленты)', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [PHOTO_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed?limit=30').set('Authorization', `Bearer ${token}`)

    expect(res.body.next_offset).toBeNull()
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).get('/feed')
    expect(res.status).toBe(401)
    await app.close()
  })
})
