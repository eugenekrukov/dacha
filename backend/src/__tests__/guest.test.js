'use strict'

// Гостевой режим (миграция 092, спека docs/spec-2026-09-guest-and-season-works.md §2.1).

const supertest = require('supertest')
const { buildApp } = require('./helpers/buildApp')

const DEVICE = '0f8c3a9e-4b1d-4c2a-9e7f-123456789abc'

function guestToken(app, userId = 7) {
  return app.jwt.sign({ userId, email: null, guest: true })
}

describe('POST /auth/guest', () => {
  it('создаёт гостя и отдаёт токен с guest:true', async () => {
    const calls = []
    const app = await buildApp({
      query: async (sql, params) => {
        calls.push({ sql, params })
        if (sql.includes('INSERT INTO users')) return { rows: [{ id: 7, is_guest: true }] }
        return { rows: [] }
      },
    })
    const res = await supertest(app.server).post('/auth/guest').send({ device_id: DEVICE, store: 'rustore' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 7, email: null, is_guest: true, plantings_limit: 3 })
    expect(app.jwt.decode(res.body.token)).toMatchObject({ userId: 7, guest: true })
    // Идемпотентность держится на ON CONFLICT по guest_device_id, а не на отдельном SELECT.
    expect(calls[0].sql).toMatch(/ON CONFLICT \(guest_device_id\)/)
    expect(calls[0].params[0]).toBe(DEVICE)
    await app.close()
  })

  it('device_id уже привязан к зарегистрированному аккаунту → 409 guest_claimed', async () => {
    const app = await buildApp({ query: async () => ({ rows: [{ id: 7, is_guest: false }] }) })
    const res = await supertest(app.server).post('/auth/guest').send({ device_id: DEVICE })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('guest_claimed')
    await app.close()
  })

  it('короткий device_id → 400', async () => {
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const res = await supertest(app.server).post('/auth/guest').send({ device_id: 'abc' })
    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('POST /auth/guest/claim', () => {
  it('пишет email/пароль в ту же строку users и отдаёт обычный токен', async () => {
    let update
    const app = await buildApp({
      query: async (sql, params) => {
        if (sql.includes('SELECT id FROM users WHERE email')) return { rows: [] }
        if (sql.startsWith('UPDATE users SET email')) {
          update = { sql, params }
          return { rows: [{ id: 7, email: 'g@test.com', email_verified: false }] }
        }
        return { rows: [] }
      },
    })
    const res = await supertest(app.server)
      .post('/auth/guest/claim')
      .set('Authorization', `Bearer ${guestToken(app)}`)
      .send({ email: 'G@test.com', password: 'secret1' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 7, email: 'g@test.com', is_guest: false })
    const payload = app.jwt.decode(res.body.token)
    expect(payload).toMatchObject({ userId: 7, email: 'g@test.com' })
    expect(payload.guest).toBeUndefined()
    // Та же строка (id гостя), только пока она гостевая; email нормализован.
    expect(update.params[0]).toBe('g@test.com')
    expect(update.params[2]).toBe(7)
    expect(update.sql).toMatch(/AND is_guest = true/)
    await app.close()
  })

  it('email занят → 409', async () => {
    const app = await buildApp({
      query: async (sql) => (sql.includes('SELECT id FROM users WHERE email') ? { rows: [{ id: 3 }] } : { rows: [] }),
    })
    const res = await supertest(app.server)
      .post('/auth/guest/claim')
      .set('Authorization', `Bearer ${guestToken(app)}`)
      .send({ email: 'taken@test.com', password: 'secret1' })
    expect(res.status).toBe(409)
    await app.close()
  })

  it('уже не гость → 409 not_guest', async () => {
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const res = await supertest(app.server)
      .post('/auth/guest/claim')
      .set('Authorization', `Bearer ${guestToken(app)}`)
      .send({ email: 'x@test.com', password: 'secret1' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('not_guest')
    await app.close()
  })
})

describe('гейт account_required', () => {
  const cases = [
    ['post', '/billing/create-payment', { plan: 'monthly' }],
    ['post', '/promo/redeem', { code: 'ABC' }],
    ['patch', '/auth/password', { current_password: 'x', new_password: 'secret1' }],
    ['post', '/auth/change-email', { new_email: 'a@b.c', password: 'x' }],
    ['post', '/auth/resend-verification', {}],
  ]
  for (const [method, url, body] of cases) {
    it(`${method.toUpperCase()} ${url} для гостя → 403`, async () => {
      const app = await buildApp({ query: async () => ({ rows: [] }) })
      const res = await supertest(app.server)[method](url)
        .set('Authorization', `Bearer ${guestToken(app)}`).send(body)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('account_required')
      await app.close()
    })
  }
})

describe('DELETE /auth/me', () => {
  it('гость удаляется без пароля', async () => {
    const sqls = []
    const app = await buildApp({
      query: async (sql) => {
        sqls.push(sql)
        if (sql.includes('SELECT password_hash, is_guest')) return { rows: [{ password_hash: null, is_guest: true }] }
        return { rows: [] }
      },
    })
    const res = await supertest(app.server)
      .delete('/auth/me').set('Authorization', `Bearer ${guestToken(app)}`).send({})
    expect(res.status).toBe(200)
    expect(sqls.some(s => s.startsWith('DELETE FROM users'))).toBe(true)
    await app.close()
  })

  it('обычному пользователю без пароля → 401', async () => {
    const app = await buildApp({
      query: async (sql) => (sql.includes('SELECT password_hash, is_guest')
        ? { rows: [{ password_hash: '$2b$10$abcdefghijklmnopqrstuv', is_guest: false }] } : { rows: [] }),
    })
    const res = await supertest(app.server)
      .delete('/auth/me').set('Authorization', `Bearer ${app.jwt.sign({ userId: 1, email: 'a@b.c' })}`).send({})
    expect(res.status).toBe(401)
    await app.close()
  })
})
