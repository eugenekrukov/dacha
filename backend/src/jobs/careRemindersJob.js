'use strict'

const cron = require('node-cron')
const pushService = require('../services/pushService')
const { wateringIntervalDays } = require('../utils/todayLogic')

function startCareRemindersJob(db) {
  cron.schedule('0 9 * * *', () => {
    runCareReminders(db)
  })
  console.log('[care-job] Запущен: проверка полива/подкормки/пересадки каждый день в 09:00')
}

// push внедряется параметром (по умолчанию — реальный сервис) для тестируемости.
async function runCareReminders(db, push = pushService) {
  const { sendWateringDigest, sendFertilizingDigest, sendTransplantDigest } = push
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

    // Корзины по участку: один сводный пуш на тип вместо пуша на каждую посадку.
    // gardenId -> { watering: [{plantingId, cropName}], fertilizing: [...], transplant: [...] }
    const buckets = new Map()
    const bucketFor = (gardenId) => {
      if (!buckets.has(gardenId)) {
        buckets.set(gardenId, { watering: [], fertilizing: [], transplant: [] })
      }
      return buckets.get(gardenId)
    }

    for (const planting of result.rows) {
      const daysSincePlanting = Math.floor(
        (Date.now() - new Date(planting.planted_at)) / 86400000
      )

      // --- Полив --- (единый расчёт интервала с учётом теплицы — utils/todayLogic)
      const wateringFreq = wateringIntervalDays(planting.watering_freq_days, planting.conditions)

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
        if (!await wasAlertSentToday(db, planting.planting_id, 'watering_due')) {
          bucketFor(planting.garden_id).watering.push(planting)
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
          if (!await wasAlertSentToday(db, planting.planting_id, 'fertilizing_due')) {
            bucketFor(planting.garden_id).fertilizing.push(planting)
          }
        }
      }

      // --- Пересадка (только стадия sowing) ---
      // Рассада в стадии посева 14+ дней без пересадки в грунт → пора пересаживать
      if (planting.stage === 'sowing' && daysSincePlanting >= 14) {
        if (!await wasAlertSentToday(db, planting.planting_id, 'transplant_due')) {
          bucketFor(planting.garden_id).transplant.push(planting)
        }
      }
    }

    let wateringAlerts = 0
    let fertilizingAlerts = 0
    let transplantAlerts = 0

    // Один дайджест на участок на тип; помечаем каждую вошедшую посадку (дедуп на день).
    for (const [gardenId, bucket] of buckets) {
      await sendDigestAndMark(db, gardenId, 'watering_due', bucket.watering, sendWateringDigest)
      await sendDigestAndMark(db, gardenId, 'fertilizing_due', bucket.fertilizing, sendFertilizingDigest)
      await sendDigestAndMark(db, gardenId, 'transplant_due', bucket.transplant, sendTransplantDigest)
      wateringAlerts    += bucket.watering.length
      fertilizingAlerts += bucket.fertilizing.length
      transplantAlerts  += bucket.transplant.length
    }

    console.log(`[care-job] Готово: участков=${buckets.size}, полив=${wateringAlerts}, подкормка=${fertilizingAlerts}, пересадка=${transplantAlerts}`)
  } catch (err) {
    console.error('[care-job] Критическая ошибка:', err.message)
  }
}

// Шлёт сводный пуш по корзине (если непустая) и помечает каждую посадку как уведомлённую.
async function sendDigestAndMark(db, gardenId, alertType, plantings, sendDigest) {
  if (plantings.length === 0) return
  await sendDigest(db, gardenId, plantings.map(p => p.crop_name))
  for (const p of plantings) {
    await markAlertSent(db, p.planting_id, alertType)
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

module.exports = { startCareRemindersJob, runCareReminders }
