'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// Стейтфул-мок push_tokens: эмулирует UNIQUE(user_id, token) и поведение DELETE/INSERT
// из routes/push-tokens.js, чтобы проверить перенос токена между пользователями.
function makeStatefulDb(initialRows = []) {
  const rows = initialRows.map(r => ({ ...r }))
  return {
    rows,
    query: async (sql, params = []) => {
      if (/^DELETE FROM push_tokens WHERE token/.test(sql)) {
        const [token, userId] = params
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].token === token && rows[i].user_id !== userId) rows.splice(i, 1)
        }
        return { rows: [] }
      }
      if (/^INSERT INTO push_tokens/.test(sql)) {
        const [userId, token, platform, provider] = params
        const existing = rows.find(r => r.user_id === userId && r.token === token)
        if (existing) {
          existing.provider = provider
        } else {
          rows.push({ user_id: userId, token, platform, provider })
        }
        return { rows: [] }
      }
      if (/^DELETE FROM push_tokens WHERE user_id/.test(sql)) {
        const [userId, token] = params
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].user_id === userId && rows[i].token === token) rows.splice(i, 1)
        }
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
}

describe('POST /push-tokens', () => {
  it('переносит токен от другого пользователя при входе на этом же устройстве', async () => {
    // user_id=2 уже зарегистрировал этот токен раньше (пример из прода: смена аккаунта на устройстве)
    const db = makeStatefulDb([{ user_id: 2, token: 'DEVICE_TOKEN', platform: 'android', provider: 'fcm' }])
    const app = await buildApp(db)
    const token = makeToken(app, 6)

    const res = await supertest(app.server)
      .post('/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'DEVICE_TOKEN', provider: 'fcm' })

    expect(res.status).toBe(204)
    expect(db.rows).toEqual([{ user_id: 6, token: 'DEVICE_TOKEN', platform: 'android', provider: 'fcm' }])
    await app.close()
  })

  it('обычная регистрация — не трогает токены других пользователей', async () => {
    const db = makeStatefulDb([{ user_id: 2, token: 'OTHER_DEVICE_TOKEN', platform: 'android', provider: 'rustore' }])
    const app = await buildApp(db)
    const token = makeToken(app, 6)

    const res = await supertest(app.server)
      .post('/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'MY_TOKEN', provider: 'fcm' })

    expect(res.status).toBe(204)
    expect(db.rows).toEqual(expect.arrayContaining([
      { user_id: 2, token: 'OTHER_DEVICE_TOKEN', platform: 'android', provider: 'rustore' },
      { user_id: 6, token: 'MY_TOKEN', platform: 'android', provider: 'fcm' },
    ]))
    await app.close()
  })

  it('400 если токен не передан', async () => {
    const db = makeStatefulDb()
    const app = await buildApp(db)
    const token = makeToken(app, 6)

    const res = await supertest(app.server)
      .post('/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
    await app.close()
  })

  it('401 без токена авторизации', async () => {
    const db = makeStatefulDb()
    const app = await buildApp(db)

    const res = await supertest(app.server)
      .post('/push-tokens')
      .send({ token: 'DEVICE_TOKEN' })

    expect(res.status).toBe(401)
    await app.close()
  })
})

describe('DELETE /push-tokens', () => {
  it('удаляет токен текущего пользователя', async () => {
    const db = makeStatefulDb([{ user_id: 6, token: 'DEVICE_TOKEN', platform: 'android', provider: 'fcm' }])
    const app = await buildApp(db)
    const token = makeToken(app, 6)

    const res = await supertest(app.server)
      .delete('/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'DEVICE_TOKEN' })

    expect(res.status).toBe(204)
    expect(db.rows).toEqual([])
    await app.close()
  })
})
