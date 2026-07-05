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

  it('email в другом регистре всё равно находит аккаунт', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    let queriedEmail = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        queriedEmail = params[0]
        return { rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash }] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'U@Test.com', password: 'correct-password' })

    expect(res.status).toBe(200)
    expect(queriedEmail).toBe('u@test.com')
    await app.close()
  })

  // H1: store — клиентское поле, а samsung даёт бесплатный доступ (рекламный магазин).
  // Клиент НЕ должен уметь повысить себя до samsung через login (обход оплаты).
  it('не повышает аккаунт до samsung через login (обход платного гейта)', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    let storeUpdatedTo = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('SELECT * FROM users')) {
          return { rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash, store: 'rustore' }] }
        }
        if (sql.includes('UPDATE users SET store')) { storeUpdatedTo = params[0]; return { rows: [] } }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'u@test.com', password: 'correct-password', store: 'samsung' })

    expect(res.status).toBe(200)
    expect(storeUpdatedTo).toBeNull()  // store НЕ обновлён на samsung
    await app.close()
  })

  it('обновляет store при переключении между платными магазинами (rustore → gplay)', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    let storeUpdatedTo = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('SELECT * FROM users')) {
          return { rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash, store: 'rustore' }] }
        }
        if (sql.includes('UPDATE users SET store')) { storeUpdatedTo = params[0]; return { rows: [] } }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'u@test.com', password: 'correct-password', store: 'gplay' })

    expect(res.status).toBe(200)
    expect(storeUpdatedTo).toBe('gplay')
    await app.close()
  })

  it('samsung-аккаунт может переключиться на другой магазин (понижение разрешено)', async () => {
    const hash = await bcrypt.hash('correct-password', 10)
    let storeUpdatedTo = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('SELECT * FROM users')) {
          return { rows: [{ id: 1, email: 'u@test.com', name: 'U', password_hash: hash, store: 'samsung' }] }
        }
        if (sql.includes('UPDATE users SET store')) { storeUpdatedTo = params[0]; return { rows: [] } }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'u@test.com', password: 'correct-password', store: 'rustore' })

    expect(res.status).toBe(200)
    expect(storeUpdatedTo).toBe('rustore')
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

describe('POST /auth/verify-email', () => {
  it('валидный код → 200 + email_verified=true', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 5 }] }  // код найден
        return { rows: [] }  // UPDATE email_codes / UPDATE users
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.email_verified).toBe(true)
    await app.close()
  })

  it('неверный/истёкший код → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/auth/verify-email').send({ code: '123456' })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('POST /auth/forgot-password', () => {
  it('существующий email → 200 (код выдан)', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 1 }] }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/forgot-password')
      .send({ email: 'user@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('несуществующий email → тоже 200 (не раскрываем существование)', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))

    const res = await supertest(app.server)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('невалидный email → 400', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/auth/forgot-password').send({ email: 'bad' })
    expect(res.status).toBe(400)
    await app.close()
  })

  it('email в другом регистре всё равно находит аккаунт (баг: было 200 без письма)', async () => {
    let queriedEmail = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('SELECT id FROM users')) { queriedEmail = params[0]; return { rows: [{ id: 1 }] } }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/forgot-password')
      .send({ email: 'User@Test.com' })

    expect(res.status).toBe(200)
    expect(queriedEmail).toBe('user@test.com')
    await app.close()
  })
})

describe('POST /auth/reset-password', () => {
  it('валидный код → 200', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 1 }] }
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 7 }] }
        return { rows: [] }
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/reset-password')
      .send({ email: 'user@test.com', code: '123456', password: 'newpassword' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('неверный код → 400', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 1 }] }
        return { rows: [] }  // код не найден
      },
    }))

    const res = await supertest(app.server)
      .post('/auth/reset-password')
      .send({ email: 'user@test.com', code: '000000', password: 'newpassword' })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('несуществующий email → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))

    const res = await supertest(app.server)
      .post('/auth/reset-password')
      .send({ email: 'nobody@test.com', code: '123456', password: 'newpassword' })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('короткий пароль → 400', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server)
      .post('/auth/reset-password')
      .send({ email: 'user@test.com', code: '123456', password: '123' })
    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('PATCH /auth/password', () => {
  const bcrypt = require('bcrypt')

  it('верный текущий пароль → 200 + ok', async () => {
    const hash = await bcrypt.hash('oldpass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldpass', new_password: 'newpass123' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('неверный текущий пароль → 401', async () => {
    const hash = await bcrypt.hash('oldpass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'wrong', new_password: 'newpass123' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('новый пароль < 6 → 400', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldpass', new_password: '123' })
    expect(res.status).toBe(400)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).patch('/auth/password').send({ current_password: 'a', new_password: 'bbbbbb' })
    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('POST /auth/change-email', () => {
  const bcrypt = require('bcrypt')
  let bcryptHash
  beforeAll(async () => { bcryptHash = await bcrypt.hash('mypass', 10) })

  function appWith(emailFree) {
    return buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT email, password_hash FROM users'))
          return { rows: [{ email: 'old@test.com', password_hash: bcryptHash }] }
        if (sql.includes('SELECT id FROM users WHERE email'))
          return { rows: emailFree ? [] : [{ id: 99 }] }
        return { rows: [] }
      },
    }))
  }

  it('верный пароль + свободный email → 200 ok', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'new@test.com', password: 'mypass' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('неверный пароль → 401', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'new@test.com', password: 'wrong' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('занятый email → 409', async () => {
    const app = await appWith(false)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'taken@test.com', password: 'mypass' })
    expect(res.status).toBe(409)
    await app.close()
  })

  it('невалидный email → 400', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'bad', password: 'mypass' })
    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('POST /auth/confirm-email-change', () => {
  it('валидный код + свободный pending → 200 + новый email', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 9 }] }
        if (sql.includes('SELECT pending_email')) return { rows: [{ pending_email: 'new@test.com' }] }
        if (sql.includes('SELECT id FROM users WHERE email')) return { rows: [] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('new@test.com')
    await app.close()
  })

  it('неверный код → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
    expect(res.status).toBe(400)
    await app.close()
  })

  it('pending занят между шагами → 409', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 9 }] }
        if (sql.includes('SELECT pending_email')) return { rows: [{ pending_email: 'new@test.com' }] }
        if (sql.includes('SELECT id FROM users WHERE email')) return { rows: [{ id: 77 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })
    expect(res.status).toBe(409)
    await app.close()
  })
})

describe('DELETE /auth/me', () => {
  const bcrypt = require('bcrypt')

  it('верный пароль → 200, анонимизирует payments и удаляет users', async () => {
    const hash = await bcrypt.hash('mypass', 10)
    const calls = []
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        calls.push(sql)
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'mypass' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(calls.some(s => s.includes('UPDATE payments SET user_id = NULL'))).toBe(true)
    expect(calls.some(s => s.includes('DELETE FROM users'))).toBe(true)
    await app.close()
  })

  it('неверный пароль → 401', async () => {
    const hash = await bcrypt.hash('mypass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).delete('/auth/me').send({ password: 'x' })
    expect(res.status).toBe(401)
    await app.close()
  })
})
