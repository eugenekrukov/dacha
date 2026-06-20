'use strict'

const supertest = require('supertest')
const { buildApp } = require('./helpers/buildApp')
const { makeToken, verifyToken, buildUrl } = require('../utils/unsubscribe')

describe('unsubscribe token (HMAC)', () => {
  it('round-trip: makeToken проходит verifyToken', () => {
    const t = makeToken(42)
    expect(verifyToken(42, t)).toBe(true)
  })

  it('чужой/битый токен не проходит', () => {
    const t = makeToken(42)
    expect(verifyToken(43, t)).toBe(false)   // другой userId
    expect(verifyToken(42, t + 'x')).toBe(false)
    expect(verifyToken(42, '')).toBe(false)
    expect(verifyToken(42, undefined)).toBe(false)
  })

  it('buildUrl содержит userId и токен', () => {
    const url = buildUrl(7)
    expect(url).toContain('u=7')
    expect(url).toContain(`t=${makeToken(7)}`)
  })
})

describe('GET /unsubscribe', () => {
  function makeMockDb() {
    const updated = []
    return {
      updated,
      async query(sql, params) {
        if (/UPDATE users SET email_optout/.test(sql)) {
          updated.push(params[0])
          return { rows: [] }
        }
        throw new Error('Неожиданный SQL в моке: ' + sql)
      }
    }
  }

  it('валидный токен → 200 и ставит email_optout', async () => {
    const db = makeMockDb()
    const app = await buildApp(db)
    const res = await supertest(app.server)
      .get(`/unsubscribe?u=5&t=${makeToken(5)}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('отписаны')
    expect(db.updated).toEqual([5])
    await app.close()
  })

  it('битый токен → 400 и НЕ трогает БД', async () => {
    const db = makeMockDb()
    const app = await buildApp(db)
    const res = await supertest(app.server).get('/unsubscribe?u=5&t=deadbeef')
    expect(res.status).toBe(400)
    expect(db.updated).toHaveLength(0)
    await app.close()
  })
})
