'use strict'

const cron = require('node-cron')
const { updateGardenWeather } = require('../services/weatherService')
const { sendFrostAlert, sendHeatAlert } = require('../services/pushService')

function startWeatherJob(db) {
  runWeatherUpdate(db)

  cron.schedule('0 */3 * * *', () => {
    runWeatherUpdate(db)
  })

  console.log('[weather-job] Запущен: обновление каждые 3 часа')
}

async function runWeatherUpdate(db) {
  console.log('[weather-job] Запуск обновления погоды...')

  try {
    const result = await db.query(
      'SELECT id, lat, lon FROM gardens WHERE lat IS NOT NULL AND lon IS NOT NULL'
    )

    if (result.rows.length === 0) {
      console.log('[weather-job] Нет участков с координатами')
      return
    }

    console.log(`[weather-job] Участков для обновления: ${result.rows.length}`)

    for (const garden of result.rows) {
      try {
        const weather = await updateGardenWeather(db, garden)
        if (weather && weather.frost_risk) {
          await sendFrostAlert(db, garden.id, weather.min_temp_c)
        }
        if (weather && weather.heat_risk) {
          await sendHeatAlert(db, garden.id, weather.max_temp_c)
        }
      } catch (err) {
        console.error(`[weather-job] Ошибка для участка ${garden.id}: ${err.message}`)
      }
    }

    console.log('[weather-job] Обновление завершено')
  } catch (err) {
    console.error('[weather-job] Критическая ошибка:', err.message)
  }
}

module.exports = { startWeatherJob }
