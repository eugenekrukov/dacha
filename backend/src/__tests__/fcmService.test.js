'use strict'

const fcm = require('../services/fcmService')
const push = require('../services/pushService')

// Фейк FCM-ошибки с кодом (как у firebase-admin: e.errorInfo.code).
function fcmError(code) {
  const e = new Error('FCM error: ' + code)
  e.errorInfo = { code }
  return e
}

describe('fcmService', () => {
  afterEach(() => { delete process.env.FCM_SERVICE_ACCOUNT_PATH; fcm._reset() })

  it('FCM не настроен → sendViaFcm возвращает {delivered:false, invalidToken:false}', async () => {
    fcm._reset()
    expect(await fcm.sendViaFcm('some-token', 'Заголовок', 'Текст', {})).toEqual({ delivered: false, invalidToken: false })
  })

  it('успешная отправка → {delivered:true, invalidToken:false}', async () => {
    fcm._setMessaging({ send: async () => 'projects/x/messages/123' })
    expect(await fcm.sendViaFcm('tok', 't', 'b', {})).toEqual({ delivered: true, invalidToken: false })
  })

  it('registration-token-not-registered → {delivered:false, invalidToken:true} (токен мёртв)', async () => {
    fcm._setMessaging({ send: async () => { throw fcmError('messaging/registration-token-not-registered') } })
    expect(await fcm.sendViaFcm('tok', 't', 'b', {})).toEqual({ delivered: false, invalidToken: true })
  })

  it('прочая ошибка FCM → invalidToken:false (токен не трогаем)', async () => {
    fcm._setMessaging({ send: async () => { throw fcmError('messaging/internal-error') } })
    expect(await fcm.sendViaFcm('tok', 't', 'b', {})).toEqual({ delivered: false, invalidToken: false })
  })
})

describe('pushService.sendPush — маршрутизация по провайдеру', () => {
  it('provider=fcm без настройки FCM → {delivered:false, invalidToken:false}', async () => {
    fcm._reset()
    expect(await push.sendPush('tok', 't', 'b', {}, 'fcm')).toEqual({ delivered: false, invalidToken: false })
  })

  it('provider=rustore без RUSTORE_PUSH_* → {delivered:false, invalidToken:false} (не падает)', async () => {
    const prevId = process.env.RUSTORE_PUSH_PROJECT_ID
    const prevTok = process.env.RUSTORE_PUSH_SERVICE_TOKEN
    delete process.env.RUSTORE_PUSH_PROJECT_ID
    delete process.env.RUSTORE_PUSH_SERVICE_TOKEN
    expect(await push.sendPush('tok', 't', 'b', {}, 'rustore')).toEqual({ delivered: false, invalidToken: false })
    if (prevId) process.env.RUSTORE_PUSH_PROJECT_ID = prevId
    if (prevTok) process.env.RUSTORE_PUSH_SERVICE_TOKEN = prevTok
  })
})

describe('pushService — доставка дайджеста и чистка мёртвых токенов', () => {
  afterEach(() => fcm._reset())

  // Мок-БД: возвращает токены участка и копит DELETE по токенам.
  function makeDb(tokens) {
    const deleted = []
    return {
      deleted,
      query: async (sql, params) => {
        // DELETE проверяем раньше SELECT: его текст тоже содержит "FROM push_tokens".
        if (sql.startsWith('DELETE FROM push_tokens')) { deleted.push(params[0]); return { rows: [] } }
        if (sql.includes('FROM push_tokens')) return { rows: tokens }
        return { rows: [] }
      },
    }
  }

  it('успешная доставка → digest возвращает true, токен не удаляется', async () => {
    fcm._setMessaging({ send: async () => 'ok' })
    const db = makeDb([{ token: 'good', provider: 'fcm' }])
    expect(await push.sendWateringDigest(db, 1, ['Томат'])).toBe(true)
    expect(db.deleted).toEqual([])
  })

  it('мёртвый токен → digest возвращает false и токен удаляется из push_tokens', async () => {
    fcm._setMessaging({ send: async () => { throw fcmError('messaging/registration-token-not-registered') } })
    const db = makeDb([{ token: 'deadtok', provider: 'fcm' }])
    expect(await push.sendWateringDigest(db, 1, ['Томат'])).toBe(false)
    expect(db.deleted).toEqual(['deadtok'])
  })

  it('нет токенов у участка → false (нечего доставлять)', async () => {
    const db = makeDb([])
    expect(await push.sendFertilizingDigest(db, 1, ['Перец'])).toBe(false)
  })
})
