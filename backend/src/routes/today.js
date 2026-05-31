'use strict'

const { buildTasks, formatTasks } = require('../utils/todayLogic')

/**
 * GET /today?garden_id=
 *
 * РђРіСЂРµРіРёСЂСѓСЋС‰РёР№ СЌРЅРґРїРѕРёРЅС‚ СЌРєСЂР°РЅР° "РЎРµРіРѕРґРЅСЏ".
 * Р’РѕР·РІСЂР°С‰Р°РµС‚:
 *  - weather    вЂ” РїРѕСЃР»РµРґРЅРёР№ РїРѕРіРѕРґРЅС‹Р№ СЃРЅРёРјРѕРє СѓС‡Р°СЃС‚РєР°
 *  - tasks      вЂ” С‚РѕРї-5 РїСЂРёРѕСЂРёС‚РµС‚РЅС‹С… Р·Р°РґР°С‡ РґРЅСЏ (РїРѕР»РёРІ / РїРµСЂРµСЃР°РґРєР° / СѓР±РѕСЂРєР° / Р·Р°РјРѕСЂРѕР·РєРё)
 *  - reminders  вЂ” РЅР°РїРѕРјРёРЅР°РЅРёСЏ РЅР° СЃРµРіРѕРґРЅСЏ
 */

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    // РџСЂРѕРІРµСЂСЏРµРј РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚СЊ СѓС‡Р°СЃС‚РєР°
    const gardenRes = await fastify.db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!gardenRes.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    const garden = gardenRes.rows[0]

    const today = new Date()

    // в”Ђв”Ђ 1. РџРћР“РћР”Рђ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    const weatherRes = await fastify.db.query(
      `SELECT * FROM weather_snapshots
       WHERE garden_id=$1
       ORDER BY fetched_at DESC LIMIT 1`,
      [garden_id]
    )
    const weather = weatherRes.rows[0] || null

    // в”Ђв”Ђ 2. РђРљРўРР’РќР«Р• РџРћРЎРђР”РљР в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

    // в”Ђв”Ђ 3. РџРћРЎР›Р•Р”РќРР• Р”Р•Р™РЎРўР’РРЇ РџРћ РљРђР–Р”РћР™ РџРћРЎРђР”РљР• в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    // РџРѕР»СѓС‡Р°РµРј РґР°С‚Сѓ РїРѕСЃР»РµРґРЅРµРіРѕ РїРѕР»РёРІР° РґР»СЏ РєР°Р¶РґРѕР№ РїРѕСЃР°РґРєРё РѕРґРЅРёРј Р·Р°РїСЂРѕСЃРѕРј
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

    // в”Ђв”Ђ 4. РќРђРџРћРњРРќРђРќРРЇ РќРђ РЎР•Р“РћР”РќРЇ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
      message: r.message || `РќР°РїРѕРјРёРЅР°РЅРёРµ: ${r.type}`,
      remind_at: r.remind_at,
    }))

    // в”Ђв”Ђ 5. РЎР‘РћР РљРђ Р Р¤РћР РњРђРўРР РћР’РђРќРР• Р—РђР”РђР§ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

