'use strict'

const fetch = require('node-fetch')
const { sendViaFcm } = require('./fcmService')

const RUSTORE_PUSH_API = 'https://vkpns.rustore.ru/v1/projects'

// Маршрутизация по провайдеру токена: 'fcm' → Firebase напрямую; иначе RuStore Push (vkpns).
// @returns {{ delivered: boolean, invalidToken: boolean }}
async function sendPush(token, title, body, data = {}, provider = 'rustore') {
  if (provider === 'fcm') {
    return sendViaFcm(token, title, body, data)
  }
  return sendViaRustore(token, title, body, data)
}

// @returns {{ delivered: boolean, invalidToken: boolean }}
async function sendViaRustore(token, title, body, data = {}) {
  const projectId = process.env.RUSTORE_PUSH_PROJECT_ID
  const serviceToken = process.env.RUSTORE_PUSH_SERVICE_TOKEN

  if (!projectId || !serviceToken) {
    console.warn('[push] RUSTORE_PUSH_PROJECT_ID или RUSTORE_PUSH_SERVICE_TOKEN не заданы')
    return { delivered: false, invalidToken: false }
  }

  const payload = {
    message: {
      token,
      notification: { title, body },
      data: { ...data, title, body }
    }
  }

  try {
    const res = await fetch(`${RUSTORE_PUSH_API}/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceToken}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`[push] Ошибка отправки (${res.status}): ${err}`)
      // 404 NOT_FOUND у vkpns — токен мёртв (как у FCM), удаляем.
      return { delivered: false, invalidToken: res.status === 404 }
    }
    return { delivered: true, invalidToken: false }
  } catch (e) {
    console.error('[push] Сетевая ошибка:', e.message)
    return { delivered: false, invalidToken: false }
  }
}

// Возвращает [{ token, provider }] по участку — провайдер нужен для маршрутизации (fcm/rustore).
async function getTokensForGarden(db, gardenId) {
  const result = await db.query(
    `SELECT pt.token, pt.provider
     FROM push_tokens pt
     JOIN gardens g ON g.user_id = pt.user_id
     WHERE g.id = $1`,
    [gardenId]
  )
  return result.rows
}

// Удаляет токен из push_tokens (один физический девайс = одна строка после фикса 2026-06-13).
async function deletePushToken(db, token) {
  await db.query('DELETE FROM push_tokens WHERE token = $1', [token])
}

/**
 * Шлёт уведомление на все токены участка. Мёртвые токены (FCM/vkpns «не зарегистрирован»)
 * удаляются из БД, чтобы не копились и не маскировали отсутствие доставки.
 * @returns {boolean} delivered — доставлено ли хотя бы на одно устройство.
 */
async function sendToGarden(db, gardenId, title, body, data) {
  const tokens = await getTokensForGarden(db, gardenId)
  if (tokens.length === 0) return false
  let deliveredAny = false
  for (const t of tokens) {
    const r = await sendPush(t.token, title, body, data, t.provider)
    if (r && r.delivered) deliveredAny = true
    if (r && r.invalidToken) {
      await deletePushToken(db, t.token)
      console.log(`[push] удалён мёртвый токен (provider=${t.provider}, участок ${gardenId})`)
    }
  }
  return deliveredAny
}

async function sendFrostAlert(db, gardenId, tempC) {
  try {
    const body = `Ожидается ${tempC}°C. Укройте теплолюбивые растения!`
    const delivered = await sendToGarden(db, gardenId, '⚠️ Угроза заморозков', body, { type: 'frost_alert', garden_id: String(gardenId) })
    if (delivered) console.log(`[push] frost_alert доставлен, участок ${gardenId}`)
  } catch (e) {
    console.error('[push] Ошибка sendFrostAlert:', e.message)
  }
}

async function sendHeatAlert(db, gardenId, tempC) {
  try {
    const body = `Ожидается ${tempC}°C. Полейте растения и притените теплицу!`
    const delivered = await sendToGarden(db, gardenId, '🌡️ Сильная жара', body, { type: 'heat_alert', garden_id: String(gardenId) })
    if (delivered) console.log(`[push] heat_alert доставлен, участок ${gardenId}`)
  } catch (e) {
    console.error('[push] Ошибка sendHeatAlert:', e.message)
  }
}

// Перечисляет культуры человекочитаемо: «Томат, Огурец и ещё 2».
function listCrops(cropNames) {
  const max = 3
  if (cropNames.length <= max) return cropNames.join(', ')
  return `${cropNames.slice(0, max).join(', ')} и ещё ${cropNames.length - max}`
}

// Один сводный пуш на участок вместо отдельного на каждую посадку (борьба со спамом).
// @returns {boolean} delivered — доставлено ли хотя бы на одно устройство (для дедупа care_alert_log).
async function sendCareDigest(db, gardenId, type, title, verb, cropNames) {
  try {
    if (cropNames.length === 0) return false
    const body = `${verb}: ${listCrops(cropNames)}`
    const delivered = await sendToGarden(db, gardenId, title, body, { type, garden_id: String(gardenId) })
    if (delivered) console.log(`[push] ${type} (дайджест): ${cropNames.length} посадок, участок ${gardenId}`)
    return delivered
  } catch (e) {
    console.error(`[push] Ошибка sendCareDigest(${type}):`, e.message)
    return false
  }
}

const sendWateringDigest = (db, gardenId, cropNames) =>
  sendCareDigest(db, gardenId, 'watering_due', '💧 Нужен полив', 'Полейте', cropNames)

const sendFertilizingDigest = (db, gardenId, cropNames) =>
  sendCareDigest(db, gardenId, 'fertilizing_due', '🌿 Нужна подкормка', 'Подкормите', cropNames)

const sendTransplantDigest = (db, gardenId, cropNames) =>
  sendCareDigest(db, gardenId, 'transplant_due', '🌱 Пора пересаживать', 'Высадите в грунт', cropNames)

module.exports = {
  sendPush,
  sendFrostAlert,
  sendHeatAlert,
  sendCareDigest,
  sendWateringDigest,
  sendFertilizingDigest,
  sendTransplantDigest
}
