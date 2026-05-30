'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /actions — быстрое логирование (полил, подкормил, обработал)
  fastify.post('/', auth, async (request, reply) => {
    const { planting_id, notes } = request.body
    const action_type = request.body.action_type ?? request.body.type
    // action_type: watering | fertilizing | treatment | other
    const result = await fastify.db.query(
      `INSERT INTO action_logs (planting_id, action_type, notes, logged_at)
       VALUES ($1,$2,$3,NOW()) RETURNING *`,
      [planting_id, action_type, notes]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /actions?planting_id=
  fastify.get('/', auth, async (request) => {
    const { planting_id, limit = 50 } = request.query
    const result = await fastify.db.query(
      `SELECT al.* FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE g.user_id = $1 ${planting_id ? 'AND al.planting_id = $2' : ''}
       ORDER BY al.logged_at DESC
       LIMIT $${planting_id ? 3 : 2}`,
      planting_id ? [request.user.userId, planting_id, limit] : [request.user.userId, limit]
    )
    return result.rows
  })
}
