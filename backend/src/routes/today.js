'use strict'

/**
 * GET /today?garden_id=
 *
 * Агрегирующий эндпоинт экрана "Сегодня".
 * Возвращает:
 *  - weather    — последний погодный снимок участка
 *  - tasks      — топ-5 приоритетных задач дня (полив / пересадка / уборка / заморозки)
 *  - reminders  — напоминания на сегодня
 */

const TASK_PRIORITY = {
  frost_alert:    1,  // 🚨 угроза заморозков
  transplant_due: 2,  // 🌱 пора пикировать / высаживать
  watering_due:   3,  // 💧 нужен полив
  harvest_due:    4,  // 🌾 пора убирать
  reminder:       5,  // 📅 напоминание
}

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

    // ── 4. СБОРКА ЗАДАЧ ──────────────────────────────────────────────────────
    const tasks = []

    for (const p of plantings) {
      const plantedAt = new Date(p.planted_at)
      const daysSincePlanting = Math.floor((today - plantedAt) / 86400000)

      // 🚨 Угроза заморозков
      if (
        p.frost_sensitive &&
        weather &&
        weather.frost_risk === true
      ) {
        tasks.push({
          type: 'frost_alert',
          priority: TASK_PRIORITY.frost_alert,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `Угроза заморозков! Защитите ${p.crop_name}`,
          icon: '🚨',
        })
      }

      // 🌱 Пора пикировать / высаживать в грунт
      if (
        p.transplant_days &&
        daysSincePlanting >= p.transplant_days &&
        p.stage === 'sprouted'
      ) {
        tasks.push({
          type: 'transplant_due',
          priority: TASK_PRIORITY.transplant_due,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `${p.crop_name} — пора пересаживать (${daysSincePlanting} дней)`,
          icon: '🌱',
        })
      }

      // 💧 Нужен полив
      if (p.watering_freq_days) {
        const lastWatered = lastWateredMap[p.id] || plantedAt
        const daysSinceWatering = Math.floor((today - lastWatered) / 86400000)
        if (daysSinceWatering >= p.watering_freq_days) {
          tasks.push({
            type: 'watering_due',
            priority: TASK_PRIORITY.watering_due,
            planting_id: p.id,
            crop_name: p.crop_name,
            message: `${p.crop_name} — нужен полив (${daysSinceWatering} дн. без воды)`,
            icon: '💧',
            days_overdue: daysSinceWatering - p.watering_freq_days,
          })
        }
      }

      // 🌾 Пора убирать урожай
      if (
        p.harvest_days &&
        daysSincePlanting >= p.harvest_days &&
        ['growing', 'flowering', 'harvesting'].includes(p.stage)
      ) {
        tasks.push({
          type: 'harvest_due',
          priority: TASK_PRIORITY.harvest_due,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `${p.crop_name} — пора убирать урожай!`,
          icon: '🌾',
        })
      }
    }

    // ── 5. НАПОМИНАНИЯ НА СЕГОДНЯ ────────────────────────────────────────────
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
    const reminders = remindersRes.rows.map(r => ({
      type: 'reminder',
      priority: TASK_PRIORITY.reminder,
      reminder_id: r.id,
      crop_name: r.crop_name,
      message: r.message || `Напоминание: ${r.type}`,
      remind_at: r.remind_at,
      icon: '📅',
    }))

    tasks.push(...reminders)

    // ── 6. Сортировка: сначала высший приоритет, потом по просроченности ─────
    tasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return (b.days_overdue || 0) - (a.days_overdue || 0)
    })

    // ── 7. Итоговый ответ ─────────────────────────────────────────────────────
    const topTasks = tasks.slice(0, 5).map(t => ({
      type: t.type,
      priority: t.priority,
      title: t.message || t.type,
      description: t.crop_name ? `Культура: ${t.crop_name}` : '',
      planting_id: t.planting_id || null,
      crop_name: t.crop_name || null,
      days_overdue: t.days_overdue || null,
    }))

    return {
      garden_id: garden.id,
      garden_name: garden.name,
      weather: weather
        ? {
            temp_min: weather.temp_c,
            temp_max: weather.feels_like_c,
            humidity: weather.humidity,
            condition: weather.condition,
            frost_risk: weather.frost_risk,
          }
        : null,
      tasks: topTasks,
      tasks_total: tasks.length,
      reminders_today: reminders.length,
      generated_at: today.toISOString(),
    }
  })
}
