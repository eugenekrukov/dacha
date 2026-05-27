'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /harvests
  fastify.post('/', auth, async (request, reply) => {
    const { planting_id, weight_kg, quantity, notes } = request.body
    const result = await fastify.db.query(
      `INSERT INTO harvests (planting_id, weight_kg, quantity, notes, harvested_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [planting_id, weight_kg, quantity, notes]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /harvests?garden_id=
  fastify.get('/', auth, async (request) => {
    const { garden_id } = request.query
    const result = await fastify.db.query(
      `SELECT h.*, c.name as crop_name, p.planted_at
       FROM harvests h
       JOIN plantings p ON p.id = h.planting_id
       JOIN crops c ON c.id = p.crop_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE g.user_id=$1 ${garden_id ? 'AND g.id=$2' : ''}
       ORDER BY h.harvested_at DESC`,
      garden_id ? [request.user.userId, garden_id] : [request.user.userId]
    )
    return result.rows
  })
}
