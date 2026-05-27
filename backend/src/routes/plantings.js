'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /plantings
  fastify.post('/', auth, async (request, reply) => {
    const { garden_id, crop_id, planted_at, quantity, notes } = request.body
    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, notes, stage)
       VALUES ($1,$2,$3,$4,$5,'sowing') RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, notes]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /plantings?garden_id=
  fastify.get('/', auth, async (request) => {
    const { garden_id } = request.query
    const result = await fastify.db.query(
      `SELECT p.*, c.name as crop_name, c.category, c.watering_freq_days, c.frost_sensitive
       FROM plantings p
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE g.user_id = $1 ${garden_id ? 'AND p.garden_id = $2' : ''}
       ORDER BY p.planted_at DESC`,
      garden_id ? [request.user.userId, garden_id] : [request.user.userId]
    )
    return result.rows
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
    const { stage } = request.body // sowing | sprouted | growing | flowering | harvesting | done
    const result = await fastify.db.query(
      `UPDATE plantings SET stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [stage, request.params.id]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
}
