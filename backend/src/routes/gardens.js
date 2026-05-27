'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /gardens
  fastify.post('/', auth, async (request, reply) => {
    const { name, lat, lon, region, soil_type, climate_zone } = request.body
    const userId = request.user.userId

    const result = await fastify.db.query(
      `INSERT INTO gardens (user_id, name, lat, lon, region, soil_type, climate_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, lat, lon, region, soil_type, climate_zone]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /gardens
  fastify.get('/', auth, async (request) => {
    const result = await fastify.db.query(
      'SELECT * FROM gardens WHERE user_id = $1 ORDER BY created_at DESC',
      [request.user.userId]
    )
    return result.rows
  })

  // GET /gardens/:id
  fastify.get('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      'SELECT * FROM gardens WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    return result.rows[0]
  })

  // PUT /gardens/:id
  fastify.put('/:id', auth, async (request, reply) => {
    const { name, lat, lon, region, soil_type, climate_zone } = request.body
    const result = await fastify.db.query(
      `UPDATE gardens SET name=$1, lat=$2, lon=$3, region=$4, soil_type=$5, climate_zone=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [name, lat, lon, region, soil_type, climate_zone, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    return result.rows[0]
  })
}
