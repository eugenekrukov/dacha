'use strict'

const cron = require('node-cron')
const { sendWateringAlert, sendFertilizingAlert, sendTransplantAlert } = require('../services/pushService')

function startCareRemindersJob(db) {
  cron.schedule('0 9 * * *', () => {
    runCareReminders(db)
  })
  console.log('[care-job] Запущен: проверка полива/подкормки/пересадки каждый день в 09:00')
}

async function runCareReminders(db) {
  console.log('[care-job] Проверка просроченных задач ухода...')

  try {
    const result = await db.query(`
      SELECT
        p.id            AS planting_id,
        p.garden_id,
        p.planted_at,
        p.conditions,
        p.stage,
        c.name          AS crop_name,
        c.watering_freq_days,
        c.fertilizing_schedule,
        c.transplant_days,
        g.user_id
      FROM plantings p
      JOIN crops c ON c.id = p.crop_id
      JOIN gardens g ON g.id = p.garden_id
      WHERE p.stage != 'done'
    `)

    if (result.rows.length === 0) {
      console.log('[care-job] Нет активных посадок')
      return
    }

    let wateringAlerts = 0
    let fertilizingAlerts = 0
    let transplantAlerts = 0

    for (const planting of result.rows) {
      const daysSincePlanting = Math.floor(
        (Date.now() - new Date(planting.planted_at)) / 86400000
      )

      // --- Полив ---
      const wateringFreqRaw = planting.watering_freq_days || 3
      const wateringFreq = planting.conditions === 'greenhouse'
        ? Math.round(wateringFreqRaw * 1.3)
        : wateringFreqRaw

      const lastWateredRow = await db.query(
        `SELECT logged_at FROM action_logs
         WHERE planting_id = $1 AND action_type = 'watering'
         ORDER BY logged_at DESC LIMIT 1`,
        [planting.planting_id]
      )
      const daysSinceWatered = lastWateredRow.rows[0]
        ? Math.floor((Date.now() - new Date(lastWateredRow.rows[0].logged_at)) / 86400000)
        : daysSincePlanting

      if (daysSinceWatered >= wateringFreq) {
        const alreadySent = await wasAlertSentToday(db, planting.planting_id, 'watering_due')
        if (!alreadySent) {
          await sendWateringAlert(db, planting.garden_id, planting.crop_name, daysSinceWatered)
          await markAlertSent(db, planting.planting_id, 'watering_due')
          wateringAlerts++
        }
      }

      // --- Подкормка ---
      const schedule = planting.fertilizing_schedule || []
      if (schedule.length > 0) {
        const lastFertilizedRow = await db.query(
          `SELECT logged_at FROM action_logs
           WHERE planting_id = $1 AND action_type = 'fertilizing'
           ORDER BY logged_at DESC LIMIT 1`,
          [planting.planting_id]
        )
        const daysSinceFertilized = lastFertilizedRow.rows[0]
          ? Math.floor((Date.now() - new Date(lastFertilizedRow.rows[0].logged_at)) / 86400000)
          : daysSincePlanting

        if (daysSinceFertilized > 14) {
          const alreadySent = await wasAlertSentToday(db, planting.planting_id, 'fertilizing_due')
          if (!alreadySent) {
            await sendFertilizingAlert(db, planting.garden_id, planting.crop_name, daysSinceFertilized)
            await markAlertSent(db, planting.planting_id, 'fertilizing_due')
            fertilizingAlerts++
          }
        }
      }

      // --- Пересадка (только стадия sowing) ---
      // Рассада в стадии посева 14+ дней без пересадки в грунт → пора пересаживать
      if (planting.stage === 'sowing' && daysSincePlanting >= 14) {
        const alreadySent = await wasAlertSentToday(db, planting.planting_id, 'transplant_due')
        if (!alreadySent) {
          await sendTransplantAlert(db, planting.garden_id, planting.crop_name, daysSincePlanting)
          await markAlertSent(db, planting.planting_id, 'transplant_due')
          transplantAlerts++
        }
      }
    }

    console.log(`[care-job] Готово: полив=${wateringAlerts}, подкормка=${fertilizingAlerts}, пересадка=${transplantAlerts}`)
  } catch (err) {
    console.error('[care-job] Критическая ошибка:', err.message)
  }
}

async function wasAlertSentToday(db, plantingId, alertType) {
  const result = await db.query(
    `SELECT 1 FROM care_alert_log
     WHERE planting_id = $1
       AND alert_type = $2
       AND sent_at::date = CURRENT_DATE`,
    [plantingId, alertType]
  )
  return result.rows.length > 0
}

async function markAlertSent(db, plantingId, alertType) {
  await db.query(
    `INSERT INTO care_alert_log (planting_id, alert_type, sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (planting_id, alert_type, sent_at::date)
     DO NOTHING`,
    [plantingId, alertType]
  )
}

module.exports = { startCareRemindersJob }
