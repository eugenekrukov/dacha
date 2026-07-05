'use strict'

const { getDailyLifehack, getSeasonalTip, getStageTip, getLunarTip, getDayOfYear, getZoneDayOffset, WEATHER_TIPS } = require('../data/tips')

const STAGE_LABELS = {
  sowing: 'Посев', sprouted: 'Всходы', transplanted: 'Высажено в грунт',
  growing: 'Растёт', flowering: 'Цветёт', harvesting: 'Созревает', done: 'Завершено'
}

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /recommendations?garden_id=
  //
  // ВАЖНО: эндпоинт возвращает ТОЛЬКО информационные/контекстные советы.
  // Actionable-задачи (полив, заморозки, готовый урожай) формирует GET /today (tasks).
  // Раньше они дублировались здесь — на экране Today один и тот же пункт показывался
  // дважды (в «Задачах» и в «Советах дня»). Дубли убраны: полив/заморозки/урожай
  // живут только в задачах, здесь — то, чего в задачах нет.
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

    // Последний полив по каждой посадке — ОДИН запрос вместо N+1 (по запросу на посадку
    // в цикле ниже). Нужен только для совета «после дождя».
    const lastWateredMap = {}
    const plantingIds = plantingsRes.rows.map(p => p.id)
    if (plantingIds.length > 0) {
      const wateredRes = await db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1) AND action_type='watering'
         ORDER BY planting_id, logged_at DESC`,
        [plantingIds]
      )
      wateredRes.rows.forEach(r => { lastWateredMap[r.planting_id] = new Date(r.logged_at) })
    }

    // ── РАЗДЕЛ 1: Контекстные советы по посадкам (НЕ дублируют задачи) ───────

    for (const planting of plantingsRes.rows) {
      const daysSincePlanting = Math.floor((now - new Date(planting.planted_at)) / 86400000)

      // Данные о поливе нужны только для совета «после дождя» (ниже).
      const lastWatered = lastWateredMap[planting.id]
      const daysSinceWatered = lastWatered
        ? Math.floor((now - lastWatered) / 86400000)
        : daysSincePlanting

      const wateringFreq = planting.conditions === 'greenhouse'
        ? Math.ceil((planting.watering_freq_days || 3) * 1.3)
        : (planting.watering_freq_days || 3)

      const hadRecentRain = weather && weather.precip_mm > 3

      // Жара — совет по поливу вечером (нет соответствующей задачи, не дубль)
      if (weather && weather.heat_risk) {
        recommendations.push({
          type: 'heat_stress',
          priority: 'medium',
          planting_id: planting.id,
          crop_name: planting.crop_name,
          message: `Жара ${weather.max_temp_c}°C — поливайте ${planting.crop_name} только вечером после 19:00, иначе листья получат ожог`
        })
        break // Один раз на участок достаточно
      }

      // Урожай скоро (за 5 дней) — подготовительный совет, задачи ещё нет
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

      // Дождь — напоминание, что полив можно пропустить
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

    // ── РАЗДЕЛ 3: Сезонные подсказки "пора сажать" ──────────────────────────

    const climateZone = gardenRes.rows[0].climate_zone || '4'
    const dayOfYear   = getDayOfYear(now)
    const zoneOffset  = getZoneDayOffset(climateZone)
    // Эффективный день с учётом зоны: чем теплее зона, тем "позже" идёт сезон относительно базы
    const effectiveDay = dayOfYear - zoneOffset
    const LOOKAHEAD = 14 // показываем подсказки за 2 недели до окна

    // ID культур, которые уже посажены (активные)
    const activeCropIds = new Set(plantingsRes.rows.map(p => p.crop_id))

    const sowingCropsRes = await db.query(
      `SELECT id, name, category, sowing_start_day, sowing_end_day, transplant_days
       FROM crops
       WHERE sowing_start_day IS NOT NULL
       ORDER BY sowing_start_day`
    )

    const sowingSuggestions = []

    for (const crop of sowingCropsRes.rows) {
      if (activeCropIds.has(crop.id)) continue // уже посеяно

      const start = crop.sowing_start_day
      const end   = crop.sowing_end_day

      const daysUntilStart = start - effectiveDay
      const daysIntoWindow = effectiveDay - start
      const windowDaysLeft = end - effectiveDay

      const isSeedling = !!crop.transplant_days

      if (daysIntoWindow >= 0 && windowDaysLeft >= 0) {
        // Сейчас в окне посева
        const urgency = windowDaysLeft <= 7 ? 'medium' : 'info'
        const timeMsg = windowDaysLeft <= 7
          ? `осталось ${windowDaysLeft} дн.`
          : `окно открыто до ${Math.round(windowDaysLeft / 7)} нед.`
        sowingSuggestions.push({
          type: 'sowing_season',
          priority: urgency,
          crop_name: crop.name,
          days_until: 0,
          message: isSeedling
            ? `Сейчас время сеять рассаду ${crop.name} (${timeMsg})`
            : `Сейчас время сеять ${crop.name} в грунт (${timeMsg})`
        })
      } else if (daysUntilStart > 0 && daysUntilStart <= LOOKAHEAD) {
        // Окно откроется в ближайшие 14 дней
        sowingSuggestions.push({
          type: 'sowing_soon',
          priority: 'info',
          crop_name: crop.name,
          days_until: daysUntilStart,
          message: isSeedling
            ? `Через ${daysUntilStart} дн. — время начать рассаду ${crop.name}`
            : `Через ${daysUntilStart} дн. — время сеять ${crop.name} в грунт`
        })
      }
    }

    // Сортируем: сначала текущие окна (days_until=0), потом приближающиеся
    // Ограничиваем до 4 подсказок чтобы не перегружать экран
    sowingSuggestions
      .sort((a, b) => a.days_until - b.days_until)
      .slice(0, 4)
      .forEach(s => recommendations.push({
        type: s.type,
        priority: s.priority,
        planting_id: null,
        crop_name: s.crop_name,
        message: s.message
      }))

    return recommendations
  })
}
