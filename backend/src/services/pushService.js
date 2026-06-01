'use strict'

const fetch = require('node-fetch')

const RUSTORE_PUSH_API = 'https://vkpns.rustore.ru/v1/projects'

async function sendPush(token, title, body, data = {}) {
  const projectId = process.env.RUSTORE_PUSH_PROJECT_ID
  const serviceToken = process.env.RUSTORE_PUSH_SERVICE_TOKEN

  if (!projectId || !serviceToken) {
    console.warn('[push] RUSTORE_PUSH_PROJECT_ID или RUSTORE_PUSH_SERVICE_TOKEN не заданы — пуш не отправлен')
    return
  }

  const payload = {
    message: {
      token,
      notification: { title, body },
      data
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

async function getTokensForGarden(db, gardenId) {
  const result = await db.query(
    `SELECT pt.token
     FROM push_tokens pt
     JOIN gardens g ON g.user_id = pt.user_id
     WHERE g.id = $1`,
    [gardenId]
  )
  return result.rows.map(r => r.token)
}

async function sendFrostAlert(db, gardenId, tempC) {
  try {
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return

    const title = '⚠️ Угроза заморозков'
    const body = `Ожидается ${tempC}°C. Укройте теплолюбивые растения!`

    for (const token of tokens) {
      await sendPush(token, title, body, { type: 'frost_alert', garden_id: String(gardenId) })
    }

    console.log(`[push] frost_alert отправлен для участка ${gardenId} (${tokens.length} устройств)`)
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

    for (const token of tokens) {
      await sendPush(token, title, body, { type: 'heat_alert', garden_id: String(gardenId) })
    }

    console.log(`[push] heat_alert отправлен для участка ${gardenId} (${tokens.length} устройств)`)
  } catch (e) {
    console.error('[push] Ошибка sendHeatAlert:', e.message)
  }
}

async function sendWateringAlert(db, gardenId, cropName, daysSince) {
  try {
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return

    const title = '💧 Нужен полив'
    const body = `${cropName} не поливали ${daysSince} дн. Пора полить!`

    for (const token of tokens) {
      await sendPush(token, title, body, { type: 'watering_due', garden_id: String(gardenId) })
    }

    console.log(`[push] watering_due: ${cropName} (участок ${gardenId}, ${tokens.length} устройств)`)
  } catch (e) {
    console.error('[push] Ошибка sendWateringAlert:', e.message)
  }
}

async function sendFertilizingAlert(db, gardenId, cropName, daysSince) {
  try {
    const tokens = await getTokensForGarden(db, gardenId)
    if (tokens.length === 0) return

    const title = '🌿 Нужна подкормка'
    const body = `${cropName} не подкармливали ${daysSince} дн. Пора внести удобрения!`

    for (const token of tokens) {
      await sendPush(token, title, body, { type: 'fertilizing_due', garden_id: String(gardenId) })
    }

    console.log(`[push] fertilizing_due: ${cropName} (участок ${gardenId}, ${tokens.length} устройств)`)
  } catch (e) {
    console.error('[push] Ошибка sendFertilizingAlert:', e.message)
  }
}

module.exports = { sendPush, sendFrostAlert, sendHeatAlert, sendWateringAlert, sendFertilizingAlert }
