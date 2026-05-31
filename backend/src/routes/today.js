'use strict'

const { buildTasks, formatTasks } = require('../utils/todayLogic')

/**
 * GET /today?garden_id=
 *
 * Агрегирующий эндпоинт экрана "Сегодня".
 * Возвращает:
 *  - weather    — последний погодный снимок участка
 *  - tasks      — топ-5 приоритетных задач дня (полив / пересадка / уборка / заморозки)
 *  - reminders  — напоминания на сегодня
 */

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    // Проверяем принадлежность участка
    const gardenRes = await fastify.db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!gardenRes.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    const garden = gardenRes.rows[0]

    const today = new Date()

    // ── 1. ПОГОДА ────────────────────────────────────────────────────────────
    const weatherRes = await fastify.db.query(
      `SELECT * FROM weather_snapshots
       WHERE garden_id=$1
       ORDER BY fetched_at DESC LIMIT 1`,
      [garden_id]
    )
    const weather = weatherRes.rows[0] || null

    // ── 2. АКТИВНЫЕ ПОСАДКИ ──────────────────────────────────────────────────
    const plantingsRes = await fastify.db.query(
      `SELECT p.id, p.planted_at, p.stage, p.quantity, p.notes,
              c.name as crop_name, c.category,
              c.watering_freq_days, c.transplant_days,
              c.harvest_days, c.frost_sensitive
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       WHERE p.garden_id=$1 AND p.stage NOT IN ('done')
       ORDER BY p.planted_at ASC`,
      [garden_id]
    )
    const plantings = plantingsRes.rows

    // ── 3. ПОСЛЕДНИЕ ДЕЙСТВИЯ ПО КАЖДОЙ ПОСАДКЕ ─────────────────────────────
    // Получаем дату последнего полива для каждой посадки одним запросом
    let lastWateredMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const actionsRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type = 'watered'
         ORDER BY planting_id, logged_at DESC`,
        [ids]
      )
      actionsRes.rows.forEach(r => {
        lastWateredMap[r.planting_id] = new Date(r.logged_at)
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
      priority: 5,
      reminder_id: r.id,
      crop_name: r.crop_name,
      message: r.message || `Напоминание: ${r.type}`,
      remind_at: r.remind_at,
    }))

    // ── 5. СБОРКА И ФОРМАТИРОВАНИЕ ЗАДАЧ ─────────────────────────────────────
    const rawTasks = buildTasks(plantings, weather, lastWateredMap, reminderTasks, today)
    const topTasks = formatTasks(rawTasks)

    return {
      garden_id: garden.id,
      garden_name: garden.name,
      weather: weather
        ? {
            temp_c: weather.temp_c != null ? parseFloat(weather.temp_c) : null,
            temp_min: weather.min_temp_c != null ? parseFloat(weather.min_temp_c) : null,
            temp_max: weather.max_temp_c != null ? parseFloat(weather.max_temp_c) : null,
            humidity: weather.humidity_pct,
            condition: weather.condition,
            condition_text: weather.condition_text,
            frost_risk: weather.frost_risk,
            heat_risk: weather.heat_risk,
          }
        : null,
      tasks: topTasks,
      tasks_total: rawTasks.length,
      reminders_today: reminderTasks.length,
      generated_at: today.toISOString(),
    }
  })
}
