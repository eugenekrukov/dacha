'use strict'

const { getNextCareTask, getOverdueCareTask, effectivePlantedAt, seasonLengthDays, seasonStartDoy, seasonEndDoy, effectiveHarvestDays, effectiveHarvestWindow, nextHarvestWindowDate } = require('../utils/todayLogic')
const { hasAccess, FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
const { getZoneForRegion } = require('../utils/regionCoords')
const { storedSeasonStart, storedSeasonEnd } = require('../services/seasonService')

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // Проверка принадлежности участка текущему пользователю
  async function userOwnsGarden(gardenId, userId) {
    const res = await fastify.db.query(
      'SELECT 1 FROM gardens WHERE id=$1 AND user_id=$2',
      [gardenId, userId]
    )
    return res.rows.length > 0
  }

  // Своя посадка ({id, stage, crop_id}) или null — нужна и для 404, и для гейта read-only.
  async function getOwnedPlanting(plantingId, userId) {
    const res = await fastify.db.query(
      `SELECT p.id, p.stage, p.crop_id FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [plantingId, userId]
    )
    return res.rows[0] || null
  }

  // Свободный текст сорта → id в общем справочнике crop_varieties, шаренном между всеми
  // пользователями. Сначала нечёткий поиск (pg_trgm, миграция 084) среди уже существующих
  // сортов ЭТОЙ культуры — опечатка («Бычье серце») сама подтягивается к существующей записи
  // («Бычье сердце»), а не плодит дубль. Если похожего сорта нет — заводим новый: он сразу
  // попадёт в подсказки всем пользователям при следующей посадке этой культуры. harvest_days
  // для нового сорта не знаем — оставляем NULL (расчёт срока падает на общий crops.harvest_days,
  // как для посадок вовсе без сорта).
  const VARIETY_SIMILARITY_THRESHOLD = 0.4
  async function resolveOrCreateVariety(cropId, text) {
    const match = await fastify.db.query(
      `SELECT id, name, similarity(lower(name), lower($1)) AS sim
       FROM crop_varieties WHERE crop_id = $2
       ORDER BY sim DESC LIMIT 1`,
      [text, cropId]
    )
    const best = match.rows[0]
    if (best && best.sim >= VARIETY_SIMILARITY_THRESHOLD) {
      return { id: best.id, name: best.name }
    }
    const created = await fastify.db.query(
      `INSERT INTO crop_varieties (crop_id, name, source)
       VALUES ($1, $2, 'Добавлено пользователем в приложении')
       ON CONFLICT (crop_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [cropId, text]
    )
    return created.rows[0] || null
  }

  // POST /plantings — free-тариф: до FREE_PLANTING_LIMIT активных (stage<>'done') посадок,
  // без ограничения по времени. Выше лимита — только «Дачник Про» (402).
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { garden_id, crop_id, planted_at, quantity = 1, conditions = 'soil', notes, sowing_method = 'seedling', variety, variety_id, bed_id } = request.body
    const method = sowing_method === 'direct' ? 'direct' : 'seedling'
    let varietyVal = typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : null

    // Защита от IDOR: нельзя создать посадку в чужом участке
    if (!garden_id || !(await userOwnsGarden(garden_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Garden not found or not yours' })
    }

    // Сорт из справочника должен принадлежать той же культуре — иначе «Мельба» окажется у томата.
    // При валидном variety_id заполняем variety именем сорта (старые клиенты/журнал/аналитика
    // продолжают работать без изменений).
    let varietyIdVal = null
    if (variety_id != null) {
      const varietyRes = await fastify.db.query(
        'SELECT name FROM crop_varieties WHERE id = $1 AND crop_id = $2',
        [variety_id, crop_id]
      )
      if (!varietyRes.rows[0]) return reply.code(400).send({ error: 'Invalid variety' })
      varietyIdVal = variety_id
      varietyVal = varietyRes.rows[0].name
    } else if (varietyVal) {
      // Сорт не из подсказок (свободный текст) — заводим/сопоставляем в общем справочнике.
      const resolved = await resolveOrCreateVariety(crop_id, varietyVal)
      if (resolved) { varietyIdVal = resolved.id; varietyVal = resolved.name }
    }

    const userRes = await fastify.db.query(
      'SELECT subscription_until, promo_until, store FROM users WHERE id = $1',
      [request.user.userId]
    )
    if (!hasAccess(userRes.rows[0])) {
      const countRes = await fastify.db.query(
        `SELECT COUNT(*) FROM plantings p
         JOIN gardens g ON g.id = p.garden_id
         WHERE g.user_id = $1 AND p.stage <> 'done'`,
        [request.user.userId]
      )
      if (parseInt(countRes.rows[0].count, 10) >= FREE_PLANTING_LIMIT) {
        await markLimitHit(fastify.db, request.user.userId)
        return reply.code(402).send({ error: 'plan_limit_reached', limit: FREE_PLANTING_LIMIT })
      }
    }

    // Грядка (если указана) должна принадлежать тому же участку — иначе подсказка севооборота
    // могла бы сравнивать историю чужого/другого участка.
    if (bed_id != null) {
      const bedCheck = await fastify.db.query(
        'SELECT 1 FROM garden_beds WHERE id = $1 AND garden_id = $2',
        [bed_id, garden_id]
      )
      if (!bedCheck.rows[0]) return reply.code(400).send({ error: 'Invalid bed' })
    }

    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, conditions, notes, stage, sowing_method, variety, bed_id, variety_id)
       VALUES ($1,$2,$3,$4,$5,$6,'sowing',$7,$8,$9,$10) RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, conditions, notes, method, varietyVal, bed_id ?? null, varietyIdVal]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /plantings?garden_id=
  fastify.get('/', auth, async (request) => {
    const { garden_id } = request.query
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.frost_sensitive,
              c.care_tasks, c.harvest_days, c.watering_freq_days as watering_freq_days, c.yield_per_plant_kg, c.is_perennial,
              c.harvest_doy_start, c.harvest_doy_end,
              g.climate_zone, g.region, g.season_start_doy, g.season_start_year, g.season_end_doy,
              v.harvest_days AS variety_harvest_days,
              v.harvest_doy_start AS variety_harvest_doy_start, v.harvest_doy_end AS variety_harvest_doy_end,
              (SELECT MAX(a.logged_at) FROM action_logs a WHERE a.planting_id = p.id) AS last_action_at,
              (SELECT a.action_type FROM action_logs a WHERE a.planting_id = p.id
               ORDER BY a.logged_at DESC LIMIT 1) AS last_action_type
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN crop_varieties v ON v.id = p.variety_id
       WHERE g.user_id = $1 ${garden_id ? 'AND p.garden_id = $2' : ''}
       ORDER BY p.planted_at DESC`,
      garden_id ? [request.user.userId, garden_id] : [request.user.userId]
    )

    // Care-действия по посадкам — чтобы вычислить просроченные care-задачи (overdue_care_task).
    // Источник истины тот же, что у /today (getOverdueCareTask), поэтому экраны не расходятся.
    const ids = result.rows.map(r => r.id)
    const lastCareMap = {}   // { plantingId: { action_type: Date } } — последнее care-действие по типу
    const todayCareMap = {}  // { plantingId: string[] } — care-действия за сегодня
    if (ids.length > 0) {
      const lastCareRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id, action_type) planting_id, action_type, logged_at
         FROM action_logs
         WHERE planting_id = ANY($1)
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment','thinning','runner_removal','bolt_removal','deflowering','staking','fertilizing')
         ORDER BY planting_id, action_type, logged_at DESC`,
        [ids]
      )
      lastCareRes.rows.forEach(r => {
        if (!lastCareMap[r.planting_id]) lastCareMap[r.planting_id] = {}
        lastCareMap[r.planting_id][r.action_type] = new Date(r.logged_at)
      })
      const todayCareRes = await fastify.db.query(
        `SELECT planting_id, array_agg(action_type) AS action_types
         FROM action_logs
         WHERE planting_id = ANY($1)
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment','thinning','runner_removal','bolt_removal','deflowering','staking','fertilizing')
           AND logged_at >= CURRENT_DATE
         GROUP BY planting_id`,
        [ids]
      )
      todayCareRes.rows.forEach(r => {
        todayCareMap[r.planting_id] = r.action_types
      })
    }

    // locked — посадка только для чтения на free-тарифе (см. isPlantingLocked). Отдаём флагом,
    // чтобы клиенты сразу рисовали read-only, а не узнавали о блокировке из 402 по нажатию.
    const state = await freeTierState(fastify.db, request.user.userId)

    // Вычисляем next_care_task (будущие) и overdue_care_task (просроченные/сегодня) для каждой посадки
    const now = new Date()
    const rows = result.rows.map(p => {
      // Сорт (если выбран) перекрывает срок культуры — один хелпер на все точки чтения
      // harvest_days, иначе «Сегодня»/рекомендации разъедутся с календарём.
      p.harvest_days = effectiveHarvestDays(p)
      // Многолетникам график ухода считаем от начала сезона в зоне участка (см. effectivePlantedAt).
      // Зона участка бывает не заполнена (создан до появления поля / регион не распознан) —
      // тогда берём её из региона тем же правилом, что и GET /gardens, иначе фикс сезонности
      // молча не сработал бы для таких участков.
      // Фактические границы сезона этого года (джоб погоды), иначе норма по зоне.
      const zone = p.climate_zone || getZoneForRegion(p.region)
      const seasonStart = storedSeasonStart(p, now) ?? seasonStartDoy(zone)
      const seasonEnd = storedSeasonEnd(p, now) ?? seasonEndDoy(zone)
      // Длина сезона — для перевода осенних задач (anchor:"end") в отсчёт от начала.
      const seasonLength = seasonStart && seasonEnd ? seasonEnd - seasonStart : null
      const plantedAt = effectivePlantedAt(new Date(p.planted_at), p.is_perennial, now, seasonStart)
      const daysSincePlanting = Math.floor((now - plantedAt) / 86400000)
      // Завершённым посадкам уход не нужен
      // Многолетнику передаём длину сезона: когда весь уход текущего сезона позади
      // (осенняя посадка, смотрим летом), next_care_task берётся из следующего сезона,
      // а не молчит до годовщины. Однолетнику следующего сезона нет → null.
      const seasonDays = p.is_perennial ? seasonLengthDays(plantedAt) : null
      const nextCareTask = p.stage === 'done'
        ? null
        : getNextCareTask(p.care_tasks, daysSincePlanting, p.harvest_days, seasonDays, seasonLength)
      const overdueCareTask = p.stage === 'done'
        ? null
        : getOverdueCareTask(p.care_tasks, new Date(p.planted_at), now, p.harvest_days, lastCareMap[p.id] || {}, todayCareMap[p.id] || [], p.is_perennial, seasonStart, seasonLength, p.created_at ? new Date(p.created_at) : null)
      // Ожидаемая дата урожая = эффективная дата посадки + harvest_days (для многолетников —
      // от текущего сезона, см. effectivePlantedAt). Клиенты (Android/web) показывают её в
      // календаре; раньше поле не отдавалось, и на Android событие «Урожай» не появлялось.
      // Ягодные кусты/деревья: harvest_days нет — берём ближайшую дату окна съёма
      // (effectiveHarvestWindow/nextHarvestWindowDate), сорт перекрывает окно культуры.
      const harvestWindow = !p.harvest_days && p.is_perennial ? effectiveHarvestWindow(p) : null
      const expectedHarvestAt = p.harvest_days
        ? new Date(plantedAt.getTime() + p.harvest_days * 86400000).toISOString()
        : harvestWindow
          ? nextHarvestWindowDate(harvestWindow, zone, now).toISOString()
          : null
      // Не передаём care_tasks клиенту — это внутренние данные. climate_zones/climate_zone
      // подтянуты только для расчёта якоря сезона: справочник культур отдаёт их сам (/crops),
      // а здесь они лишь раздували бы ответ на каждую посадку.
      const { care_tasks, climate_zone, region, season_start_doy, season_start_year, season_end_doy, variety_harvest_days, variety_harvest_doy_start, variety_harvest_doy_end, harvest_doy_start, harvest_doy_end, ...rest } = p
      return {
        ...rest,
        next_care_task: nextCareTask,
        overdue_care_task: overdueCareTask,
        expected_harvest_at: expectedHarvestAt,
        locked: isPlantingLocked(state, p)
      }
    })

    return rows
  })

  // GET /plantings/:id
  fastify.get('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.harvest_days, c.frost_sensitive, c.yield_per_plant_kg, c.is_perennial,
              c.harvest_doy_start, c.harvest_doy_end,
              v.harvest_days AS variety_harvest_days,
              v.harvest_doy_start AS variety_harvest_doy_start, v.harvest_doy_end AS variety_harvest_doy_end
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN crop_varieties v ON v.id = p.variety_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    const row = result.rows[0]
    row.harvest_days = effectiveHarvestDays(row)
    const { variety_harvest_days, variety_harvest_doy_start, variety_harvest_doy_end, harvest_doy_start, harvest_doy_end, ...rest } = row
    const state = await freeTierState(fastify.db, request.user.userId)
    return { ...rest, locked: isPlantingLocked(state, row) }
  })

  // PATCH /plantings/:id/stage
  fastify.patch('/:id/stage', auth, async (request, reply) => {
    const { stage } = request.body
    // Заблокированную посадку разрешено только завершать (stage='done') — как и удалять: это
    // «уменьшающая» операция, она освобождает слот free-набора, иначе выход из лимита был бы
    // возможен лишь через удаление данных.
    if (stage !== 'done') {
      const planting = await getOwnedPlanting(request.params.id, request.user.userId)
      if (!planting) return reply.code(404).send({ error: 'Planting not found' })
      const state = await freeTierState(fastify.db, request.user.userId)
      if (isPlantingLocked(state, planting)) {
        await markLimitHit(fastify.db, request.user.userId)
        return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
      }
    }
    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    const result = await fastify.db.query(
      `UPDATE plantings SET stage=$1, updated_at=NOW()
       WHERE id=$2 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$3)
       RETURNING *`,
      [stage, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })

  // DELETE /plantings/:id
  fastify.delete('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `DELETE FROM plantings WHERE id=$1
       AND garden_id IN (SELECT id FROM gardens WHERE user_id=$2)
       RETURNING id`,
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return reply.code(200).send({ deleted: true })
  })

  // PATCH /plantings/:id/info
  fastify.patch('/:id/info', auth, async (request, reply) => {
    const { planted_at, quantity, conditions, sowing_method, variety, variety_id, clear_variety_id, bed_id } = request.body
    const method = sowing_method === 'direct' || sowing_method === 'seedling' ? sowing_method : null
    // variety: строка → обрезаем; пустая строка '' → сброс в NULL; undefined → не трогаем.
    let varietyVal = variety === undefined
      ? null
      : (typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : '')

    const planting = await getOwnedPlanting(request.params.id, request.user.userId)
    if (!planting) return reply.code(404).send({ error: 'Planting not found' })
    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      await markLimitHit(fastify.db, request.user.userId)
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }

    // Сорт из справочника — та же проверка принадлежности культуре, что и в POST.
    // variety_id === null (явный сброс) отдельно от undefined (не трогаем). clear_variety_id:true —
    // тот же сброс, но отдельным булевым полем: Moshi (Android) по умолчанию не сериализует null
    // отдельно от «поле отсутствует», поэтому клиенту нечем послать явный null для variety_id.
    let varietyIdSet = false
    let varietyIdVal = null
    if (clear_variety_id === true) {
      varietyIdSet = true
    } else if (variety_id !== undefined) {
      varietyIdSet = true
      if (variety_id !== null) {
        const varietyRes = await fastify.db.query(
          'SELECT name FROM crop_varieties WHERE id = $1 AND crop_id = $2',
          [variety_id, planting.crop_id]
        )
        if (!varietyRes.rows[0]) return reply.code(400).send({ error: 'Invalid variety' })
        varietyIdVal = variety_id
        varietyVal = varietyRes.rows[0].name
      }
    }
    // Свободный текст (не выбран из подсказок, variety_id не пришёл) — в общий справочник.
    if (varietyIdVal == null && varietyVal) {
      const resolved = await resolveOrCreateVariety(planting.crop_id, varietyVal)
      if (resolved) { varietyIdVal = resolved.id; varietyVal = resolved.name; varietyIdSet = true }
    }

    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    if (bed_id != null) {
      const bedCheck = await fastify.db.query(
        `SELECT 1 FROM garden_beds b
         JOIN plantings p ON p.garden_id = b.garden_id AND p.id = $2
         JOIN gardens g ON g.id = p.garden_id AND g.user_id = $3
         WHERE b.id = $1`,
        [bed_id, request.params.id, request.user.userId]
      )
      if (!bedCheck.rows[0]) return reply.code(400).send({ error: 'Invalid bed' })
    }
    const result = await fastify.db.query(
      `UPDATE plantings
       SET planted_at    = COALESCE($1, planted_at),
           quantity      = COALESCE($2, quantity),
           conditions    = COALESCE($3, conditions),
           sowing_method = COALESCE($4, sowing_method),
           variety       = CASE WHEN $7::text IS NULL THEN variety
                                WHEN $7 = '' THEN NULL
                                ELSE $7 END,
           bed_id        = COALESCE($8, bed_id),
           variety_id    = CASE WHEN $9::boolean THEN $10::integer ELSE variety_id END,
           updated_at    = NOW()
       WHERE id = $5 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$6)
       RETURNING *`,
      [planted_at ?? null, quantity ?? null, conditions ?? null, method, request.params.id, request.user.userId, varietyVal, bed_id ?? null, varietyIdSet, varietyIdVal]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
}
