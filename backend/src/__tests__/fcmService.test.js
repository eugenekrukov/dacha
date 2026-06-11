'use strict'

const fcm = require('../services/fcmService')
const push = require('../services/pushService')

describe('fcmService', () => {
  afterEach(() => { delete process.env.FCM_SERVICE_ACCOUNT_PATH; fcm._reset() })

  it('FCM не настроен (нет FCM_SERVICE_ACCOUNT_PATH) → sendViaFcm возвращает false', async () => {
    fcm._reset()
    expect(await fcm.sendViaFcm('some-token', 'Заголовок', 'Текст', {})).toBe(false)
  })
})

describe('pushService.sendPush — маршрутизация по провайдеру', () => {
  it('provider=fcm без настройки FCM → false (ушло в FCM-ветку)', async () => {
    fcm._reset()
    expect(await push.sendPush('tok', 't', 'b', {}, 'fcm')).toBe(false)
  })

  it('provider=rustore без RUSTORE_PUSH_* → не падает (ушло в RuStore-ветку)', async () => {
    const prevId = process.env.RUSTORE_PUSH_PROJECT_ID
    const prevTok = process.env.RUSTORE_PUSH_SERVICE_TOKEN
    delete process.env.RUSTORE_PUSH_PROJECT_ID
    delete process.env.RUSTORE_PUSH_SERVICE_TOKEN
    // RuStore-ветка при отсутствии ключей просто предупреждает и возвращает undefined
    await expect(push.sendPush('tok', 't', 'b', {}, 'rustore')).resolves.toBeUndefined()
    if (prevId) process.env.RUSTORE_PUSH_PROJECT_ID = prevId
    if (prevTok) process.env.RUSTORE_PUSH_SERVICE_TOKEN = prevTok
  })
})
