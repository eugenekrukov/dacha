'use strict'

const cron = require('node-cron')
const pushService = require('../services/pushService')
const { wateringStatus, RAIN_AS_WATERING_MM } = require('../utils/todayLogic')

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
        p.sowing_method,
        c.name          AS crop_name,
        c.watering_freq_days,
        c.watering_details,
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

    // Последнее действие полива/подкормки по каждой посадке — ОДИН запрос на тип вместо
    // N+1 (по запросу на посадку в цикле). Джоб проходит по всем активным посадкам всех
    // пользователей, поэтому per-planting SELECT'ы масштабировались линейно по всей базе.
    const plantingIds = result.rows.map(p => p.planting_id)
    const lastWateredMap = {}
    const lastFertilizedMap = {}
    {
      const wRes = await db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type = 'watering'
         ORDER BY planting_id, logged_at DESC`,
        [plantingIds]
      )
      wRes.rows.forEach(r => { lastWateredMap[r.planting_id] = new Date(r.logged_at) })

      const fRes = await db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type = 'fertilizing'
         ORDER BY planting_id, logged_at DESC`,
        [plantingIds]
      )
      fRes.rows.forEach(r => { lastFertilizedMap[r.planting_id] = new Date(r.logged_at) })
    }

    // Погода и последний дождь по участкам — теми же правилами, что на экране «Сегодня».
    // Без этого пуш в 09:00 зовёт поливать под дождём, а экран задачу уже не показывает.
    const weatherByGarden = {}
    const lastRainByGarden = {}
    {
      const wRes = await db.query(
        `SELECT DISTINCT ON (garden_id) * FROM weather_snapshots
         WHERE fetched_at > NOW() - INTERVAL '24 hours'
         ORDER BY garden_id, fetched_at DESC`
      )
      wRes.rows.forEach(r => { weatherByGarden[r.garden_id] = r })

      const rRes = await db.query(
        `SELECT garden_id, MAX(fetched_at) AS rained_at FROM weather_snapshots
         WHERE precip_mm >= $1 AND fetched_at > NOW() - INTERVAL '7 days'
         GROUP BY garden_id`,
        [RAIN_AS_WATERING_MM]
      )
      rRes.rows.forEach(r => { lastRainByGarden[r.garden_id] = new Date(r.rained_at) })
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

      // --- Полив --- (единый расчёт с экраном «Сегодня» — utils/todayLogic.wateringStatus:
      // стадия, теплица, испарение, зачёт дождя и отмена по прогнозу)
      const water = wateringStatus(
        planting,
        weatherByGarden[planting.garden_id] || null,
        lastWateredMap[planting.planting_id] || new Date(planting.planted_at),
        lastRainByGarden[planting.garden_id] || null,
        new Date()
      )

      if (water.due) {
        if (!await wasAlertSentToday(db, planting.planting_id, 'watering_due')) {
          bucketFor(planting.garden_id).watering.push(planting)
        }
      }

      // --- Подкормка (только если есть запись расписания для текущей стадии) ---
      // Зеркалит логику buildTasks: transplanted → growing, как на клиенте.
      const schedule = planting.fertilizing_schedule || []
      const fertStage = planting.stage === 'transplanted' ? 'growing' : planting.stage
      const fertEntry = schedule.find(f => f.stage === fertStage)
      if (fertEntry) {
        const lastFertilized = lastFertilizedMap[planting.planting_id]
        const daysSinceFertilized = lastFertilized
          ? Math.floor((Date.now() - lastFertilized) / 86400000)
          : daysSincePlanting

        if (daysSinceFertilized > 14) {
          if (!await wasAlertSentToday(db, planting.planting_id, 'fertilizing_due')) {
            bucketFor(planting.garden_id).fertilizing.push(planting)
          }
        }
      }

      // --- Пересадка (только рассадные: sowing_method='seedling' и есть transplant_days) ---
      // Прямой посев в грунт не пересаживают.
      if (
        planting.sowing_method !== 'direct' &&
        planting.transplant_days &&
        planting.stage === 'sowing' &&
        daysSincePlanting >= planting.transplant_days
      ) {
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

// Шлёт сводный пуш по корзине (если непустая) и помечает каждую посадку как уведомлённую —
// ТОЛЬКО при фактической доставке. Иначе (мёртвый токен / нет устройств) пуш не дошёл, и
// помечать нельзя: повторим завтра, когда токен обновится. Раньше помечали безусловно, из-за
// чего проваленные доставки выглядели как успешные и баг с протухшим токеном маскировался.
async function sendDigestAndMark(db, gardenId, alertType, plantings, sendDigest) {
  if (plantings.length === 0) return
  const delivered = await sendDigest(db, gardenId, plantings.map(p => p.crop_name))
  if (!delivered) return
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
  // Дедуп на день обеспечивает wasAlertSentToday() (проверка перед вставкой); cron — раз в сутки,
  // гонок нет. ON CONFLICT по выражению sent_at::date не используем: у таблицы нет matching
  // unique-индекса, а bare-выражение в таргете давало syntax error и роняло весь care-job.
  await db.query(
    `INSERT INTO care_alert_log (planting_id, alert_type, sent_at)
     VALUES ($1, $2, NOW())`,
    [plantingId, alertType]
  )
}

module.exports = { startCareRemindersJob, runCareReminders }
