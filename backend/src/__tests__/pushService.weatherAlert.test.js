'use strict'

const { sendHeatAlert, sendFrostAlert } = require('../services/pushService')
const fcm = require('../services/fcmService')

// FCM реально настроен только в проде — подставляем фейковый успешный клиент,
// иначе sendToGarden ничего не "доставит" и дедуп-ветку не проверить.
beforeEach(() => fcm._setMessaging({ send: async () => 'projects/x/messages/123' }))
afterEach(() => fcm._reset())

// Мок-БД: маршрутизация по тексту SQL. alertSent — управляет дедупом weather_alert_log.
// tokens — эмулирует push_tokens/gardens JOIN, чтобы sendToGarden реально "доставил".
function makeDb({ alertSent = false, tokens = [{ token: 't1', provider: 'fcm' }] } = {}) {
  const inserts = []
  return {
    inserts,
    query: async (sql, params) => {
      if (sql.includes('FROM push_tokens')) return { rows: tokens }
      if (sql.includes('FROM weather_alert_log')) return { rows: alertSent ? [{ '?column?': 1 }] : [] }
      if (sql.includes('INSERT INTO weather_alert_log')) { inserts.push(params); return { rows: [] } }
      return { rows: [] }
    },
  }
}

describe('pushService — дедуп weather-алертов на день', () => {
  it('heat_alert ещё не отправлялся сегодня → шлёт и помечает', async () => {
    const db = makeDb({ alertSent: false })
    await sendHeatAlert(db, 1, 31.5)
    expect(db.inserts).toEqual([[1, 'heat_alert']])
  })

  it('heat_alert уже отправлялся сегодня (крон раз в 3 часа) → не шлёт повторно', async () => {
    const db = makeDb({ alertSent: true })
    await sendHeatAlert(db, 1, 31.5)
    expect(db.inserts).toEqual([])
  })

  it('frost_alert уже отправлялся сегодня → не шлёт повторно', async () => {
    const db = makeDb({ alertSent: true })
    await sendFrostAlert(db, 1, -2)
    expect(db.inserts).toEqual([])
  })
})
