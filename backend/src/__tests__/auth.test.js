'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// ─── Мок-БД ──────────────────────────────────────────────────────────────────

function makeMockDb(overrides = {}) {
  return {
    query: async (sql, params) => ({ rows: [] }),
    ...overrides,
  }
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  let app

  beforeEach(async () => {
    // По умолчанию: email не занят, INSERT возвращает нового пользователя
    app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM users')) return { rows: [] }  // email свободен
        if (sql.includes('INSERT INTO users'))
          return { rows: [{ id: 1, email: 'new@test.com', name: 'Test', trial_started_at: new Date().toISOString() }] }
        return { rows: [] }
      },
    }))
  })

  afterEach(async () => app.close())

  it('успешная регистрация возвращает 201 + token + user', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'password123', name: 'Test' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toMatchObject({ email: 'new@test.com', name: 'Test' })
    expect(res.body.user.trial_active).toBe(true)
    expect(res.body.user.trial_days_left).toBe(7)
  })

  it('регистрация без имени возвращает 201 (name опционально)', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toMatchObject({ email: 'new@test.com' })
  })

  it('повторный email возвращает 409', async () => {
    const appConflict = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 1 }] }
        return { rows: [] }
      },
    }))

    const res = await supertest(appConflict.server)
      .post('/auth/register')
      .send({ email: 'exists@test.com', password: 'password123', name: 'Test' })

    expect(res.status).toBe(409)
    await appConflict.close()
  })

  it('невалидный email возвращает 400', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123', name: 'Test' })

    expect(res.status).toBe(400)
  })

  it('пароль < 6 символов возвращает 400', async () => {
    const res = await supertest(app.server)
      .post('/auth/register')
      .send({ email: 'test@test.com', password: '123', name: 'Test' })

    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  const bcrypt = require('bcrypt')

  it('успешный логин возвращает 200 + token', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash }] }),
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'u@test.com', password: 'correct-password' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    await app.close()
  })

  it('неверный пароль возвращает 401', async () => {
    const hash = await bcrypt.hash('correct', 10)
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash }] }),
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'u@test.com', password: 'wrong-password' })

    expect(res.status).toBe(401)
    await app.close()
  })

  it('несуществующий email возвращает 401', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [] }),  // пользователь не найден
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'password' })

    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('GET /auth/me', () => {
  it('с валидным токеном возвращает профиль', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ id: 1, email: 'me@test.com', name: 'Me' }] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ email: 'me@test.com' })
    await app.close()
  })

  it('без токена возвращает 401', async () => {
    const app = await buildApp(makeMockDb())

    const res = await supertest(app.server).get('/auth/me')
    expect(res.status).toBe(401)
    await app.close()
  })

  it('свежий триал → trial_active=true, trial_days_left=7', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ id: 1, email: 'me@test.com', name: 'Me', trial_started_at: new Date().toISOString() }] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trial_active).toBe(true)
    expect(res.body.trial_days_left).toBe(7)
    await app.close()
  })

  it('триал старше 7 дней → trial_active=false, trial_days_left=0', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString()
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ id: 1, email: 'me@test.com', name: 'Me', trial_started_at: eightDaysAgo }] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.trial_active).toBe(false)
    expect(res.body.trial_days_left).toBe(0)
    await app.close()
  })
})
