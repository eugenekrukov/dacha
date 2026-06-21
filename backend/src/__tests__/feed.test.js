'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// Строки в том виде, в каком их отдаёт UNION-запрос: { type, ts, data(json) }.
const PHOTO_ROW = {
  type: 'photo',
  ts: '2026-06-22T10:00:00.000Z',
  data: { photo_id: 7, planting_id: 1, crop_name: 'Томат', action_id: 3, action_type: 'watering', caption: 'первый лист' },
}
const HARVEST_ROW = {
  type: 'milestone',
  ts: '2026-06-20T08:00:00.000Z',
  data: { kind: 'first_harvest', planting_id: 2, crop_name: 'Клубника', weight_kg: '0.40' },
}

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('GET /feed', () => {
  it('маппит фото: достраивает url/thumb_url и плоскую форму', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [PHOTO_ROW] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server).get('/feed').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      type: 'photo', date: PHOTO_ROW.ts, planting_id: 1, crop_name: 'Томат',
      action_type: 'watering', url: '/photos/file/7', thumb_url: '/photos/file/7?thumb=1',
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
