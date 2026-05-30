'use strict'

const { getCoordsForRegion } = require('../utils/regionCoords')
const { updateGardenWeather } = require('../services/weatherService')

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /gardens
  fastify.post('/', auth, async (request, reply) => {
    const { name, region, soil_type, climate_zone } = request.body
    const userId = request.user.userId

    // Если координаты не переданы — определяем по региону
    const coords = getCoordsForRegion(region)
    const lat = request.body.lat ?? coords.lat
    const lon = request.body.lon ?? coords.lon

    const result = await fastify.db.query(
      `INSERT INTO gardens (user_id, name, lat, lon, region, soil_type, climate_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, lat, lon, region, soil_type ?? null, climate_zone ?? null]
    )
    const garden = result.rows[0]

    // Сразу обновляем погоду для нового участка (не ждём 3-часового цикла)
    if (lat && lon) {
      updateGardenWeather(fastify.db, garden).catch(() => {})
    }

    return reply.code(201).send(garden)
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
    const { name, region, soil_type, climate_zone } = request.body
    const coords = getCoordsForRegion(region)
    const lat = request.body.lat ?? coords.lat
    const lon = request.body.lon ?? coords.lon

    const result = await fastify.db.query(
      `UPDATE gardens SET name=$1, lat=$2, lon=$3, region=$4, soil_type=$5, climate_zone=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [name, lat, lon, region, soil_type, climate_zone, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    return result.rows[0]
  })
}
