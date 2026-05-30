'use strict'

const fetch = require('node-fetch')

const RUSTORE_PUSH_API = 'https://vkpns.rustore.ru/v1/projects'

/**
 * Отправляет push-уведомление одному пользователю.
 * Документация: https://www.rustore.ru/help/sdk/push-notifications/send-push-notifications
 *
 * @param {string} token   — push-токен устройства
 * @param {string} title   — заголовок уведомления
 * @param {string} body    — текст уведомления
 * @param {Object} data    — дополнительные данные (опционально)
 */
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
      notification: {
        title,
        body
      },
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

/**
 * Отправляет frost_alert всем пользователям затронутого участка.
 *
 * @param {Object} db       — pg Pool
 * @param {number} gardenId
 * @param {number} tempC    — ожидаемая температура
 */
async function sendFrostAlert(db, gardenId, tempC) {
  try {
    // Получаем все push-токены пользователей участка
    const result = await db.query(
      `SELECT pt.token
       FROM push_tokens pt
       JOIN gardens g ON g.user_id = pt.user_id
       WHERE g.id = $1`,
      [gardenId]
    )

    if (result.rows.length === 0) return

    const title = '⚠️ Угроза заморозков'
    const body = `Ожидается ${tempC}°C. Укройте теплолюбивые растения!`

    for (const { token } of result.rows) {
      await sendPush(token, title, body, { type: 'frost_alert', garden_id: String(gardenId) })
    }

    console.log(`[push] frost_alert отправлен для участка ${gardenId} (${result.rows.length} устройств)`)
  } catch (e) {
    console.error('[push] Ошибка sendFrostAlert:', e.message)
  }
}

module.exports = { sendPush, sendFrostAlert }
