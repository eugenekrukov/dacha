'use strict'

// Отправка пушей напрямую через Firebase Cloud Messaging (HTTP v1) для устройств с Google
// (флейворы gplay/samsung). Включается заданием FCM_SERVICE_ACCOUNT_PATH — путь к JSON сервисного
// аккаунта Firebase (Project Settings → Service accounts → Generate private key). Без него FCM
// отключён (как pushService/emailService): функции no-op, флоу не падает.
//
// firebase-admin требуется (require) лениво — только когда путь задан, чтобы тесты/окружения без
// FCM не тянули тяжёлую зависимость.

let messaging
let tried = false

function getMessaging() {
  if (tried) return messaging
  tried = true

  const saPath = process.env.FCM_SERVICE_ACCOUNT_PATH
  if (!saPath) {
    console.warn('[fcm] FCM_SERVICE_ACCOUNT_PATH не задан — отправка через FCM отключена')
    messaging = null
    return null
  }

  try {
    const admin = require('firebase-admin')
    const serviceAccount = require(saPath)
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    }
    messaging = admin.messaging()
  } catch (e) {
    console.error('[fcm] инициализация не удалась:', e.message)
    messaging = null
  }
  return messaging
}

// Только для тестов — сбросить кэш после смены env.
function _reset() {
  messaging = undefined
  tried = false
}

// Только для тестов — подставить фейковый messaging (без firebase-admin/SA-файла).
function _setMessaging(m) {
  messaging = m
  tried = true
}

// Коды ошибок FCM, означающие, что токен мёртв (устройство переустановлено / токен отозван) —
// такой токен нужно удалить из push_tokens, иначе он копится и маскирует «нет доставки».
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/**
 * Отправляет пуш на FCM-токен. data приводится к строкам (требование FCM).
 * @returns {{ delivered: boolean, invalidToken: boolean }}
 *   delivered — доставлено в FCM; invalidToken — токен мёртв, его следует удалить.
 */
async function sendViaFcm(token, title, body, data = {}) {
  const m = getMessaging()
  if (!m) return { delivered: false, invalidToken: false }

  const stringData = {}
  for (const [k, v] of Object.entries(data)) stringData[k] = String(v)

  try {
    await m.send({
      token,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high', notification: { channelId: 'dacha_reminders' } }
    })
    return { delivered: true, invalidToken: false }
  } catch (e) {
    const code = e.errorInfo && e.errorInfo.code
    console.error('[fcm] ошибка отправки:', code || e.message)
    return { delivered: false, invalidToken: DEAD_TOKEN_CODES.has(code) }
  }
}

module.exports = { sendViaFcm, _reset, _setMessaging }
