'use strict'

const cron = require('node-cron')
const { updateGardenWeather } = require('../services/weatherService')

/**
 * Запускает фоновый джоб обновления погоды.
 * Расписание: каждые 3 часа (в 0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00, 21:00)
 *
 * @param {Object} db — pg Pool (fastify.db)
 */
function startWeatherJob(db) {
  // Запускаем сразу при старте (чтобы не ждать первые 3 часа)
  runWeatherUpdate(db)

  // Затем по расписанию — каждые 3 часа
  cron.schedule('0 */3 * * *', () => {
    runWeatherUpdate(db)
  })

  console.log('[weather-job] Запущен: обновление каждые 3 часа')
}

async function runWeatherUpdate(db) {
  console.log('[weather-job] Запуск обновления погоды...')

  try {
    // Берём все участки с координатами
    const result = await db.query(
      'SELECT id, lat, lon FROM gardens WHERE lat IS NOT NULL AND lon IS NOT NULL'
    )

    if (result.rows.length === 0) {
      console.log('[weather-job] Нет участков с координатами')
      return
    }

    console.log(`[weather-job] Участков для обновления: ${result.rows.length}`)

    // Обрабатываем последовательно, чтобы не перегружать API
    for (const garden of result.rows) {
      try {
        await updateGardenWeather(db, garden)
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
