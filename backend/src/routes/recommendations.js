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
      `SELECT p.*, c.name as crop_name, c.watering_freq_days, c.frost_sensitive, c.harvest_days,
              c.fertilizing_schedule, c.watering_details,
              p.quantity, p.conditions
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
        `SELECT logged_at FROM action_logs WHERE planting_id=$1 AND action_type='watering' ORDER BY logged_at DESC LIMIT 1`,
        [planting.id]
      )
      const daysSinceWatered = lastWatered.rows[0]
        ? Math.floor((Date.now() - new Date(lastWatered.rows[0].logged_at)) / 86400000)
        : 999

      // В теплице полив реже (меньше испарение)
      const wateringFreq = planting.conditions === 'greenhouse'
        ? Math.ceil((planting.watering_freq_days || 3) * 1.3)
        : (planting.watering_freq_days || 3)
      if (daysSinceWatered >= wateringFreq) {
        recommendations.push({
          type: 'watering',
          priority: 'high',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `Пора полить ${planting.crop_name} — прошло ${daysSinceWatered} дн. с последнего полива${planting.conditions === 'greenhouse' ? ' (теплица)' : ''}`
        })
      }

      // Слой 2: Погода — заморозки (теплица защищает)
      if (weather && planting.frost_sensitive && weather.min_temp_c <= 2 && planting.conditions !== 'greenhouse') {
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

      // Слой 4: Подкормка по стадии роста
      const schedule = planting.fertilizing_schedule || []
      const fertEntry = schedule.find(f => f.stage === planting.stage)
      if (fertEntry) {
        const lastFertilized = await db.query(
          `SELECT logged_at FROM action_logs WHERE planting_id=$1 AND action_type='fertilizing' ORDER BY logged_at DESC LIMIT 1`,
          [planting.id]
        )
        const daysSinceFertilized = lastFertilized.rows[0]
          ? Math.floor((Date.now() - new Date(lastFertilized.rows[0].logged_at)) / 86400000)
          : 999
        if (daysSinceFertilized > 14) {
          recommendations.push({
            type: 'fertilizing',
            priority: 'medium',
            planting_id: planting.id,
            crop_name: planting.crop_name,
            message: `Пора подкормить ${planting.crop_name} (стадия: ${planting.stage})${fertEntry.product_example ? ' — ' + fertEntry.product_example : ''}`
          })
        }
      }
    }

    return recommendations
  })
}
