'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')
const { isLifetimePromo } = require('../utils/access')

/**
 * Stateful-мок БД для /promo/redeem. Хранит таблицы promo_codes и users в памяти
 * и реагирует на конкретные SQL-запросы роута (по подстроке).
 */
function makeMockDb({ codes = {}, users = {} } = {}) {
  return {
    state: { codes, users },
    async query(sql, params) {
      const s = this.state
      if (sql.includes('FROM promo_codes WHERE code')) {
        const c = s.codes[params[0]]
        return {
          rows: c ? [{
            type: c.type,
            duration_days: c.duration_days ?? null,
            expires_at: c.expires_at ?? null,
            redeemed_by: c.redeemed_by
          }] : []
        }
      }
      if (sql.includes('UPDATE promo_codes SET redeemed_by')) {
        const [userId, code] = params
        const c = s.codes[code]
        if (!c || c.redeemed_by) return { rows: [] }
        c.redeemed_by = userId
        c.redeemed_at = new Date()
        return { rows: [{ type: c.type, duration_days: c.duration_days ?? null }] }
      }
      if (sql.includes('SELECT promo_until FROM users')) {
        const u = s.users[params[0]] || {}
        return { rows: [{ promo_until: u.promo_until || null }] }
      }
      if (sql.includes('UPDATE users SET promo_until')) {
        const [until, userId] = params
        s.users[userId] = { ...(s.users[userId] || {}), promo_until: until }
        return { rows: [] }
      }
      throw new Error('Неожиданный SQL в моке: ' + sql)
    }
  }
}

describe('POST /promo/redeem', () => {
  it('погашение month-кода → доступ ~30 дней, код помечен использованным', async () => {
    const db = makeMockDb({ codes: { 'DACHA-AAAA-BBBB': { type: 'month', redeemed_by: null } } })
    const app = await buildApp(db)
    const token = makeToken(app, 1)

    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`)
      .send({ code: 'dacha-aaaa-bbbb' })   // регистр и пробелы нормализуются

    expect(res.status).toBe(200)
    expect(res.body.type).toBe('month')
    expect(res.body.promo_active).toBe(true)
    expect(res.body.promo_lifetime).toBe(false)
    const days = (new Date(res.body.promo_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)
    expect(db.state.codes['DACHA-AAAA-BBBB'].redeemed_by).toBe(1)
    await app.close()
  })

  it('погашение lifetime-кода → promo_lifetime=true', async () => {
    const db = makeMockDb({ codes: { 'DACHA-LIFE-TIME': { type: 'lifetime', redeemed_by: null } } })
    const app = await buildApp(db)
    const token = makeToken(app, 1)

    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-LIFE-TIME' })

    expect(res.status).toBe(200)
    expect(res.body.promo_lifetime).toBe(true)
    expect(isLifetimePromo(res.body.promo_until)).toBe(true)
    await app.close()
  })

  it('несуществующий код → 404 invalid_code', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-XXXX-XXXX' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('invalid_code')
    await app.close()
  })

  it('уже использованный код → 409 code_already_used', async () => {
    const db = makeMockDb({ codes: { 'DACHA-USED-CODE': { type: 'month', redeemed_by: 99 } } })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-USED-CODE' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('code_already_used')
    await app.close()
  })

  it('lifetime не понижается до месяца при повторном погашении month-кода', async () => {
    const db = makeMockDb({
      codes: { 'DACHA-MNTH-CODE': { type: 'month', redeemed_by: null } },
      users: { 1: { promo_until: new Date('2999-12-31T00:00:00.000Z') } }
    })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-MNTH-CODE' })
    expect(res.status).toBe(200)
    expect(res.body.promo_lifetime).toBe(true)
    await app.close()
  })

  it('код с произвольным сроком (days 90) → доступ ~90 дней', async () => {
    const db = makeMockDb({ codes: { 'DACHA-D90D-CODE': { type: 'days', duration_days: 90, redeemed_by: null } } })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-D90D-CODE' })
    expect(res.status).toBe(200)
    expect(res.body.promo_lifetime).toBe(false)
    const days = (new Date(res.body.promo_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(89)
    expect(days).toBeLessThan(91)
    await app.close()
  })

  it('код с истёкшим дедлайном активации → 410 code_expired', async () => {
    const db = makeMockDb({
      codes: { 'DACHA-EXPR-CODE': { type: 'month', duration_days: 30, redeemed_by: null, expires_at: new Date(Date.now() - 86_400_000) } }
    })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-EXPR-CODE' })
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('code_expired')
    // код не должен быть погашен
    expect(db.state.codes['DACHA-EXPR-CODE'].redeemed_by).toBeNull()
    await app.close()
  })

  it('код с будущим дедлайном активации → 200', async () => {
    const db = makeMockDb({
      codes: { 'DACHA-FUTR-CODE': { type: 'month', duration_days: 30, redeemed_by: null, expires_at: new Date(Date.now() + 86_400_000) } }
    })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/promo/redeem').set('Authorization', `Bearer ${token}`).send({ code: 'DACHA-FUTR-CODE' })
    expect(res.status).toBe(200)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/promo/redeem').send({ code: 'X' })
    expect(res.status).toBe(401)
    await app.close()
  })
})
