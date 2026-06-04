'use strict'

const { getNextCareTask, getOverdueCareTask } = require('../utils/todayLogic')

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

  // POST /plantings — платное действие: гейт по триалу/подписке
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async (request, reply) => {
    const { garden_id, crop_id, planted_at, quantity = 1, conditions = 'soil', notes, sowing_method = 'seedling' } = request.body
    const method = sowing_method === 'direct' ? 'direct' : 'seedling'

    // Защита от IDOR: нельзя создать посадку в чужом участке
    if (!garden_id || !(await userOwnsGarden(garden_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Garden not found or not yours' })
    }

    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, conditions, notes, stage, sowing_method)
       VALUES ($1,$2,$3,$4,$5,$6,'sowing',$7) RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, conditions, notes, method]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /plantings?garden_id=
  fastify.get('/', auth, async (request) => {
    const { garden_id } = request.query
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.frost_sensitive,
              c.care_tasks, c.harvest_days, c.watering_freq_days as watering_freq_days, c.yield_per_plant_kg,
              (SELECT MAX(a.logged_at) FROM action_logs a WHERE a.planting_id = p.id) AS last_action_at
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
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
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment')
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
           AND action_type IN ('tying','pinching','hilling','pruning','weeding','loosening','treatment')
           AND logged_at >= CURRENT_DATE
         GROUP BY planting_id`,
        [ids]
      )
      todayCareRes.rows.forEach(r => {
        todayCareMap[r.planting_id] = r.action_types
      })
    }

    // Вычисляем next_care_task (будущие) и overdue_care_task (просроченные/сегодня) для каждой посадки
    const now = new Date()
    const rows = result.rows.map(p => {
      const plantedAt = new Date(p.planted_at)
      const daysSincePlanting = Math.floor((now - plantedAt) / 86400000)
      const nextCareTask = getNextCareTask(p.care_tasks, daysSincePlanting, p.harvest_days)
      // Завершённым посадкам уход не нужен
      const overdueCareTask = p.stage === 'done'
        ? null
        : getOverdueCareTask(p.care_tasks, plantedAt, now, p.harvest_days, lastCareMap[p.id] || {}, todayCareMap[p.id] || [])
      // Не передаём care_tasks клиенту — это внутренние данные
      const { care_tasks, ...rest } = p
      return { ...rest, next_care_task: nextCareTask, overdue_care_task: overdueCareTask }
    })

    return rows
  })

  // GET /plantings/:id
  fastify.get('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.harvest_days, c.frost_sensitive, c.yield_per_plant_kg
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })

  // PATCH /plantings/:id/stage
  fastify.patch('/:id/stage', auth, async (request, reply) => {
    const { stage } = request.body
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
    const { planted_at, quantity, conditions, sowing_method } = request.body
    const method = sowing_method === 'direct' || sowing_method === 'seedling' ? sowing_method : null
    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    const result = await fastify.db.query(
      `UPDATE plantings
       SET planted_at    = COALESCE($1, planted_at),
           quantity      = COALESCE($2, quantity),
           conditions    = COALESCE($3, conditions),
           sowing_method = COALESCE($4, sowing_method),
           updated_at    = NOW()
       WHERE id = $5 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$6)
       RETURNING *`,
      [planted_at ?? null, quantity ?? null, conditions ?? null, method, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
}
