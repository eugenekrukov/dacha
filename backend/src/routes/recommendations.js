'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /recommendations?garden_id=
  // Три слоя: Культура + Локация + Погода
  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    const db = fastify.db

    // 1. Получаем участок с погодой
    const gardenRes = await db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!gardenRes.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    const garden = gardenRes.rows[0]

    // 2. Активные посадки
    const plantingsRes = await db.query(
      `SELECT p.*, c.name as crop_name, c.watering_freq_days, c.frost_sensitive, c.harvest_days
       FROM plantings p JOIN crops c ON c.id=p.crop_id
       WHERE p.garden_id=$1 AND p.stage NOT IN ('done')`,
      [garden_id]
    )

    // 3. Последний погодный снимок
    const weatherRes = await db.query(
      'SELECT * FROM weather_snapshots WHERE garden_id=$1 ORDER BY fetched_at DESC LIMIT 1',
      [garden_id]
    )
    const weather = weatherRes.rows[0]

    // 4. Генерируем рекомендации
    const recommendations = []

    for (const planting of plantingsRes.rows) {
      const daysSincePlanting = Math.floor((Date.now() - new Date(planting.planted_at)) / 86400000)

      // Слой 1: Культура — полив
      const lastWatered = await db.query(
        `SELECT logged_at FROM action_logs WHERE planting_id=$1 AND action_type='watered' ORDER BY logged_at DESC LIMIT 1`,
        [planting.id]
      )
      const daysSinceWatered = lastWatered.rows[0]
        ? Math.floor((Date.now() - new Date(lastWatered.rows[0].logged_at)) / 86400000)
        : 999

      if (daysSinceWatered >= planting.watering_freq_days) {
        recommendations.push({
          type: 'watering',
          priority: 'high',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `Пора полить ${planting.crop_name} — прошло ${daysSinceWatered} дн. с последнего полива`
        })
      }

      // Слой 2: Погода — заморозки
      if (weather && planting.frost_sensitive && weather.min_temp_c <= 2) {
        recommendations.push({
          type: 'frost_alert',
          priority: 'critical',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `⚠️ Угроза заморозка! Укройте ${planting.crop_name} — ожидается ${weather.min_temp_c}°C`
        })
      }

      // Слой 3: Стадия культуры — сбор урожая
      if (planting.harvest_days && daysSincePlanting >= planting.harvest_days) {
        recommendations.push({
          type: 'harvest_ready',
          priority: 'medium',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `${planting.crop_name} готов к сбору — посадке ${daysSincePlanting} дней`
        })
      }
    }

    // Сохраняем рекомендации в БД
    if (recommendations.length > 0) {
      for (const rec of recommendations) {
        await db.query(
          `INSERT INTO recommendations (garden_id, planting_id, type, priority, message)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [garden_id, rec.planting_id, rec.type, rec.priority, rec.message]
        )
      }
    }

    return recommendations
  })
}
