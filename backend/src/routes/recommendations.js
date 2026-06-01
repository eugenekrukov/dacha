'use strict'

const { getDailyLifehack, getSeasonalTip, getStageTip, getLunarTip, WEATHER_TIPS } = require('../data/tips')

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /recommendations?garden_id=
  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    const db = fastify.db
    const now = new Date()

    // 1. Участок
    const gardenRes = await db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!gardenRes.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    // 2. Активные посадки с данными культур
    const plantingsRes = await db.query(
      `SELECT p.*, c.name as crop_name, c.watering_freq_days, c.frost_sensitive,
              c.harvest_days, c.fertilizing_schedule, c.good_neighbors, c.bad_neighbors
       FROM plantings p JOIN crops c ON c.id=p.crop_id
       WHERE p.garden_id=$1 AND p.stage NOT IN ('done')`,
      [garden_id]
    )

    // 3. Погодный снимок
    const weatherRes = await db.query(
      'SELECT * FROM weather_snapshots WHERE garden_id=$1 ORDER BY fetched_at DESC LIMIT 1',
      [garden_id]
    )
    const weather = weatherRes.rows[0]

    const recommendations = []

    // ── РАЗДЕЛ 1: Агрономические рекомендации по посадкам ───────────────────

    for (const planting of plantingsRes.rows) {
      const daysSincePlanting = Math.floor((now - new Date(planting.planted_at)) / 86400000)

      // Полив
      const lastWatered = await db.query(
        `SELECT logged_at FROM action_logs WHERE planting_id=$1 AND action_type='watering' ORDER BY logged_at DESC LIMIT 1`,
        [planting.id]
      )
      const daysSinceWatered = lastWatered.rows[0]
        ? Math.floor((now - new Date(lastWatered.rows[0].logged_at)) / 86400000)
        : daysSincePlanting

      const wateringFreq = planting.conditions === 'greenhouse'
        ? Math.ceil((planting.watering_freq_days || 3) * 1.3)
        : (planting.watering_freq_days || 3)

      // Пропустить рекомендацию полива если недавно был дождь (>3 мм)
      const hadRecentRain = weather && weather.precip_mm > 3
      if (daysSinceWatered >= wateringFreq && !hadRecentRain) {
        recommendations.push({
          type: 'watering',
          priority: 'high',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `Пора полить ${planting.crop_name} — прошло ${daysSinceWatered} дн. с последнего полива`
        })
      }

      // Заморозки (теплица защищает)
      if (weather && planting.frost_sensitive && weather.min_temp_c <= 2 && planting.conditions !== 'greenhouse') {
        recommendations.push({
          type: 'frost_alert',
          priority: 'critical',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `⚠️ Угроза заморозка! Укройте ${planting.crop_name} — ожидается ${weather.min_temp_c}°C`
        })
      }

      // Жара — совет по поливу вечером
      if (weather && weather.heat_risk) {
        recommendations.push({
          type: 'heat_stress',
          priority: 'medium',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `🌡️ Жара ${weather.max_temp_c}°C — поливайте ${planting.crop_name} только вечером после 19:00, иначе листья получат ожог`
        })
        break // Один раз на участок достаточно
      }

      // Урожай готов
      if (planting.harvest_days && daysSincePlanting >= planting.harvest_days) {
        recommendations.push({
          type: 'harvest_ready',
          priority: 'medium',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `${planting.crop_name} готов к сбору — посадке ${daysSincePlanting} дней`
        })
      }

      // Урожай скоро (за 5 дней)
      if (planting.harvest_days) {
        const daysToHarvest = planting.harvest_days - daysSincePlanting
        if (daysToHarvest > 0 && daysToHarvest <= 5) {
          recommendations.push({
            type: 'harvest_soon',
            priority: 'medium',
            planting_id: planting.id,
            crop_name: planting.crop_name,
            message: `${planting.crop_name} можно будет собрать через ${daysToHarvest} дн. — подготовьте тару`
          })
        }
      }

      // Подкормка по стадии
      const schedule = planting.fertilizing_schedule || []
      const fertEntry = schedule.find(f => f.stage === planting.stage)
      if (fertEntry) {
        const lastFertilized = await db.query(
          `SELECT logged_at FROM action_logs WHERE planting_id=$1 AND action_type='fertilizing' ORDER BY logged_at DESC LIMIT 1`,
          [planting.id]
        )
        const daysSinceFertilized = lastFertilized.rows[0]
          ? Math.floor((now - new Date(lastFertilized.rows[0].logged_at)) / 86400000)
          : daysSincePlanting
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

      // Совет по стадии культуры (не чаще 1 раза на 2 посадки чтобы не перегружать)
      if (recommendations.filter(r => r.type === 'stage_tip').length < 2) {
        const stageTip = getStageTip(planting.stage)
        if (stageTip) {
          recommendations.push({
            type: 'stage_tip',
            priority: 'info',
            planting_id: planting.id,
            crop_name: planting.crop_name,
            message: stageTip
          })
        }
      }

      // Дождь — пропустить полив
      if (hadRecentRain && daysSinceWatered >= wateringFreq) {
        recommendations.push({
          type: 'weather_tip',
          priority: 'info',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: WEATHER_TIPS.after_rain
        })
        break // Один раз достаточно
      }
    }

    // ── РАЗДЕЛ 2: Информационные рекомендации (не зависят от посадок) ───────

    // Лунный календарь
    const lunarTip = getLunarTip(now)
    if (lunarTip) {
      recommendations.push({
        type: 'lunar_tip',
        priority: 'info',
        planting_id: null,
        crop_name: null,
        message: `${lunarTip.label}: ${lunarTip.message}`
      })
    }

    // Сезонный совет
    const seasonalTip = getSeasonalTip(now)
    if (seasonalTip) {
      recommendations.push({
        type: 'seasonal_tip',
        priority: 'info',
        planting_id: null,
        crop_name: null,
        message: seasonalTip
      })
    }

    // Лайфхак дня
    const lifehack = getDailyLifehack(now)
    if (lifehack) {
      recommendations.push({
        type: 'lifehack',
        priority: 'info',
        planting_id: null,
        crop_name: null,
        message: lifehack
      })
    }

    return recommendations
  })
}
