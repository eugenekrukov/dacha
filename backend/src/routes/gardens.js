'use strict'

const { getCoordsForRegion, getZoneForRegion } = require('../utils/regionCoords')
const { updateGardenWeather } = require('../services/weatherService')

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /gardens
  fastify.post('/', auth, async (request, reply) => {
    const { name, region, soil_type, climate_zone, city, garden_type } = request.body
    const userId = request.user.userId

    let lat, lon
    if (request.body.lat != null && request.body.lon != null) {
      lat = request.body.lat
      lon = request.body.lon
    } else if (city) {
      try {
        const q = encodeURIComponent(city + ', Россия')
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
          { headers: { 'User-Agent': 'DachaKalendar/1.0 (support@dacha.studio1008.com)' } }
        )
        const data = await resp.json()
        if (data.length > 0) {
          lat = parseFloat(data[0].lat)
          lon = parseFloat(data[0].lon)
        }
      } catch (_) {}
    }
    if (lat == null || lon == null) {
      const coords = getCoordsForRegion(region)
      lat = coords.lat
      lon = coords.lon
    }

    const result = await fastify.db.query(
      `INSERT INTO gardens (user_id, name, lat, lon, region, soil_type, climate_zone, garden_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, name, lat, lon, region, soil_type ?? null,
       climate_zone ?? getZoneForRegion(region), garden_type ?? 'soil']
    )
    const garden = result.rows[0]

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
    return result.rows.map(g => ({
      ...g,
      climate_zone: g.climate_zone ?? getZoneForRegion(g.region)
    }))
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
    const { name, region, soil_type, climate_zone, city, garden_type } = request.body
    let lat, lon
    if (request.body.lat != null && request.body.lon != null) {
      lat = request.body.lat
      lon = request.body.lon
    } else if (city) {
      try {
        const q = encodeURIComponent(city + ', Россия')
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
          { headers: { 'User-Agent': 'DachaKalendar/1.0 (support@dacha.studio1008.com)' } }
        )
        const data = await resp.json()
        if (data.length > 0) {
          lat = parseFloat(data[0].lat)
          lon = parseFloat(data[0].lon)
        }
      } catch (_) {}
    }
    if (lat == null || lon == null) {
      const coords = getCoordsForRegion(region)
      lat = coords.lat
      lon = coords.lon
    }

    const result = await fastify.db.query(
      `UPDATE gardens
       SET name=$1, lat=$2, lon=$3, region=$4, soil_type=$5, climate_zone=$6, garden_type=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [name, lat, lon, region, soil_type, climate_zone ?? getZoneForRegion(region),
       garden_type ?? 'soil', request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    return result.rows[0]
  })
}
