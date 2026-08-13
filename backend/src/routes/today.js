'use strict'

const { buildTasks, formatTasks, TASK_LIMIT, RAIN_AS_WATERING_MM } = require('../utils/todayLogic')
const { getZoneForRegion } = require('../utils/regionCoords')
const { storedSeasonStart, storedSeasonEnd } = require('../services/seasonService')

// Снимок старше суток (упал weatherJob) не должен рождать задачи: «Угроза заморозков!»
// по позавчерашним данным хуже, чем её отсутствие. На карточке погоды снимок при этом
// остаётся — там у него есть своя дата.
const WEATHER_MAX_AGE_HOURS = 24

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    const gardenRes = await fastify.db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!gardenRes.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    const garden = gardenRes.rows[0]

    const today = new Date()

    // ── 1. ПОГОДА ────────────────────────────────────────────────────────────
    const weatherRes = await fastify.db.query(
      `SELECT * FROM weather_snapshots WHERE garden_id=$1 ORDER BY fetched_at DESC LIMIT 1`,
      [garden_id]
    )
    const weather = weatherRes.rows[0] || null
    // Возраст неизвестен (fetched_at пуст) → считаем снимок годным: гарантией свежести
    // занимается weatherJob, а молча терять предупреждение о заморозках хуже.
    const weatherAgeMs = weather?.fetched_at ? today - new Date(weather.fetched_at) : 0
    const weatherFresh = weather && weatherAgeMs < WEATHER_MAX_AGE_HOURS * 3600000
    const weatherForTasks = weatherFresh ? weather : null

    // ── 1.5. ПОСЛЕДНИЙ НАСТОЯЩИЙ ДОЖДЬ ───────────────────────────────────────
    // Ливень заменяет полив, иначе после 20 мм осадков приложение продолжает требовать
    // «полить, 5 дн. без воды». Отдельная таблица не нужна: снимки и так копятся каждые 3 ч,
    // берём последний, где дневная сумма осадков дотянула до полноценного полива.
    const rainRes = await fastify.db.query(
      `SELECT MAX(fetched_at) AS rained_at FROM weather_snapshots
       WHERE garden_id=$1 AND precip_mm >= $2 AND fetched_at > NOW() - INTERVAL '7 days'`,
      [garden_id, RAIN_AS_WATERING_MM]
    )
    const lastRainAt = rainRes.rows[0]?.rained_at ? new Date(rainRes.rows[0].rained_at) : null

    // ── 2. АКТИВНЫЕ ПОСАДКИ (включая care_tasks и conditions) ───────────────
    const plantingsRes = await fastify.db.query(
      `SELECT p.id, p.planted_at, p.created_at, p.stage, p.quantity, p.conditions, p.sowing_method,
              c.name as crop_name, c.category,
              c.watering_freq_days, c.watering_details, c.transplant_days,
              c.harvest_days, c.frost_sensitive, c.care_tasks, c.fertilizing_schedule, c.is_perennial
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       WHERE p.garden_id=$1 AND p.stage NOT IN ('done')
       ORDER BY p.planted_at ASC`,
      [garden_id]
    )
    const plantings = plantingsRes.rows

    // ── 3. ПОСЛЕДНИЙ ПОЛИВ ───────────────────────────────────────────────────
    let lastWateredMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const actionsRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type = 'watering'
         ORDER BY planting_id, logged_at DESC`,
        [ids]
      )
      actionsRes.rows.forEach(r => {
        lastWateredMap[r.planting_id] = new Date(r.logged_at)
      })
    }

    // ── 3.5. ПОСЛЕДНЯЯ ПОДКОРМКА ─────────────────────────────────────────────
    let lastFertilizedMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const fertRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type = 'fertilizing'
         ORDER BY planting_id, logged_at DESC`,
        [ids]
      )
      fertRes.rows.forEach(r => {
        lastFertilizedMap[r.planting_id] = new Date(r.logged_at)
      })
    }

    // ── 3.6. CARE-ДЕЙСТВИЯ ЗА СЕГОДНЯ ────────────────────────────────────────
    let careActionsToday = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const careRes = await fastify.db.query(
        `SELECT planting_id, array_agg(action_type) as action_types
         FROM action_logs
         WHERE planting_id = ANY($1)
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment','thinning','runner_removal','bolt_removal','deflowering','staking','transplanting','fertilizing')
           AND logged_at >= CURRENT_DATE
         GROUP BY planting_id`,
        [ids]
      )
      careRes.rows.forEach(r => {
        careActionsToday[r.planting_id] = r.action_types
      })
    }

    // ── 3.7. ПОСЛЕДНЕЕ CARE-ДЕЙСТВИЕ ПО ТИПУ (чтобы не повторять выполненное) ──
    let lastCareActionMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const lastCareRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id, action_type) planting_id, action_type, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1)
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment','thinning','runner_removal','bolt_removal','deflowering','staking','fertilizing')
         ORDER BY planting_id, action_type, logged_at DESC`,
        [ids]
      )
      lastCareRes.rows.forEach(r => {
        if (!lastCareActionMap[r.planting_id]) lastCareActionMap[r.planting_id] = {}
        lastCareActionMap[r.planting_id][r.action_type] = new Date(r.logged_at)
      })
    }

    // ── 3.8. ПОСЛЕДНИЙ СБОР УРОЖАЯ (cooldown для harvest_due) ───────────────
    let lastHarvestedMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const harvestRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, harvested_at
         FROM harvests
         WHERE planting_id = ANY($1)
         ORDER BY planting_id, harvested_at DESC`,
        [ids]
      )
      harvestRes.rows.forEach(r => {
        lastHarvestedMap[r.planting_id] = new Date(r.harvested_at)
      })
    }

    // ── 4. НАПОМИНАНИЯ НА СЕГОДНЯ ────────────────────────────────────────────
    const remindersRes = await fastify.db.query(
      `SELECT r.id, r.type, r.message, r.remind_at, c.name as crop_name
       FROM reminders r
       LEFT JOIN plantings p ON p.id = r.planting_id
       LEFT JOIN crops c ON c.id = p.crop_id
       WHERE r.user_id=$1
         AND r.is_sent = false
         AND r.remind_at BETWEEN NOW() - INTERVAL '1 hour' AND NOW() + INTERVAL '24 hours'
       ORDER BY r.remind_at ASC`,
      [request.user.userId]
    )
    const reminderTasks = remindersRes.rows.map(r => ({
      type: 'reminder',
      priority: 6,
      reminder_id: r.id,
      crop_name: r.crop_name,
      message: r.message || `Напоминание: ${r.type}`,
      remind_at: r.remind_at,
    }))

    // ── 5. ЗАДАЧИ ────────────────────────────────────────────────────────────
    const rawTasks = buildTasks(plantings, weatherForTasks, lastWateredMap, lastFertilizedMap, reminderTasks, today, careActionsToday, weatherForTasks?.precip_prob_pct ?? null, lastCareActionMap, lastHarvestedMap, {
      lastRainAt,
      climateZone: garden.climate_zone || getZoneForRegion(garden.region),
      // Фактическая весна этого года (джоб погоды); null → buildTasks возьмёт норму по зоне.
      seasonStart: storedSeasonStart(garden, today),
      seasonEnd: storedSeasonEnd(garden, today),
    })
    const topTasks = formatTasks(rawTasks.slice(0, TASK_LIMIT))

    return {
      garden_id: garden.id,
      garden_name: garden.name,
      weather: weather ? {
        temp_c:          weather.temp_c        != null ? parseFloat(weather.temp_c)        : null,
        temp_min:        weather.min_temp_c    != null ? parseFloat(weather.min_temp_c)    : null,
        temp_max:        weather.max_temp_c    != null ? parseFloat(weather.max_temp_c)    : null,
        humidity:        weather.humidity_pct,
        condition:       weather.condition,
        condition_text:  weather.condition_text,
        frost_risk:      weather.frost_risk,
        heat_risk:       weather.heat_risk,
        precip_prob_pct: weather.precip_prob_pct ?? null,
        soil_temp_c:     weather.soil_temp_c   != null ? parseFloat(weather.soil_temp_c)  : null,
      } : null,
      forecast: weather?.forecast_json ?? [],
      tasks:           topTasks,
      // Полное число задач до среза — клиент показывает «и ещё N», чтобы срез не выглядел
      // как «больше дел нет».
      tasks_total:     rawTasks.length,
      tasks_hidden:    Math.max(rawTasks.length - topTasks.length, 0),
      reminders_today: reminderTasks.length,
      generated_at:    today.toISOString(),
    }
  })
}
