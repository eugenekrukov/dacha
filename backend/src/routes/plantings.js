'use strict'

const { getNextCareTask } = require('../utils/todayLogic')

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
    const { garden_id, crop_id, planted_at, quantity = 1, conditions = 'soil', notes } = request.body

    // Защита от IDOR: нельзя создать посадку в чужом участке
    if (!garden_id || !(await userOwnsGarden(garden_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Garden not found or not yours' })
    }

    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, conditions, notes, stage)
       VALUES ($1,$2,$3,$4,$5,$6,'sowing') RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, conditions, notes]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /plantings?garden_id=
  fastify.get('/', auth, async (request) => {
    const { garden_id } = request.query
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.frost_sensitive,
              c.care_tasks, c.harvest_days, c.watering_freq_days as watering_freq_days,
              (SELECT MAX(a.logged_at) FROM action_logs a WHERE a.planting_id = p.id) AS last_action_at
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE g.user_id = $1 ${garden_id ? 'AND p.garden_id = $2' : ''}
       ORDER BY p.planted_at DESC`,
      garden_id ? [request.user.userId, garden_id] : [request.user.userId]
    )

    // Вычисляем next_care_task для каждой посадки
    const now = Date.now()
    const rows = result.rows.map(p => {
      const daysSincePlanting = Math.floor((now - new Date(p.planted_at)) / 86400000)
      const nextCareTask = getNextCareTask(p.care_tasks, daysSincePlanting, p.harvest_days)
      // Не передаём care_tasks клиенту — это внутренние данные
      const { care_tasks, ...rest } = p
      return { ...rest, next_care_task: nextCareTask }
    })

    return rows
  })

  // GET /plantings/:id
  fastify.get('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.harvest_days, c.frost_sensitive
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
    const { planted_at, quantity, conditions } = request.body
    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    const result = await fastify.db.query(
      `UPDATE plantings
       SET planted_at = COALESCE($1, planted_at),
           quantity   = COALESCE($2, quantity),
           conditions = COALESCE($3, conditions),
           updated_at = NOW()
       WHERE id = $4 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$5)
       RETURNING *`,
      [planted_at ?? null, quantity ?? null, conditions ?? null, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
}
