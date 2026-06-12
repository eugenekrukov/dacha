'use strict'

const fetch = require('node-fetch')
const { sendViaFcm } = require('./fcmService')

const RUSTORE_PUSH_API = 'https://vkpns.rustore.ru/v1/projects'

// Маршрутизация по провайдеру токена: 'fcm' → Firebase напрямую; иначе RuStore Push (vkpns).
async function sendPush(token, title, body, data = {}, provider = 'rustore') {
  if (provider === 'fcm') {
    return sendViaFcm(token, title, body, data)
  }
  return sendViaRustore(token, title, body, data)
}

async function sendViaRustore(token, title, body, data = {}) {
  const projectId = process.env.RUSTORE_PUSH_PROJECT_ID
  const serviceToken = process.env.RUSTORE_PUSH_SERVICE_TOKEN

  if (!projectId || !serviceToken) {
    console.warn('[push] RUSTORE_PUSH_PROJECT_ID или RUSTORE_PUSH_SERVICE_TOKEN не заданы')
    return
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
    }
  } catch (e) {
    console.error('[push] Сетевая ошибка:', e.message)
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

async function sendFrostAlert(db, gardenId, tempC) {
  try {
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return
    const title = '⚠️ Угроза заморозков'
    const body = `Ожидается ${tempC}°C. Укройте теплолюбивые растения!`
    for (const t of tokens) {
      await sendPush(t.token, title, body, { type: 'frost_alert', garden_id: String(gardenId) }, t.provider)
    }
    console.log(`[push] frost_alert для участка ${gardenId} (${tokens.length} устройств)`)
  } catch (e) {
    console.error('[push] Ошибка sendFrostAlert:', e.message)
  }
}

async function sendHeatAlert(db, gardenId, tempC) {
  try {
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return
    const title = '🌡️ Сильная жара'
    const body = `Ожидается ${tempC}°C. Полейте растения и притените теплицу!`
    for (const t of tokens) {
      await sendPush(t.token, title, body, { type: 'heat_alert', garden_id: String(gardenId) }, t.provider)
    }
    console.log(`[push] heat_alert для участка ${gardenId} (${tokens.length} устройств)`)
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
async function sendCareDigest(db, gardenId, type, title, verb, cropNames) {
  try {
    if (cropNames.length === 0) return
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return
    const body = `${verb}: ${listCrops(cropNames)}`
    for (const t of tokens) {
      await sendPush(t.token, title, body, { type, garden_id: String(gardenId) }, t.provider)
    }
    console.log(`[push] ${type} (дайджест): ${cropNames.length} посадок, участок ${gardenId}, ${tokens.length} устройств`)
  } catch (e) {
    console.error(`[push] Ошибка sendCareDigest(${type}):`, e.message)
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
