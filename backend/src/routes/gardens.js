'use strict'

const { getCoordsForRegion, getZoneForRegion } = require('../utils/regionCoords')
const { updateGardenWeather } = require('../services/weatherService')

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /gardens
  fastify.post('/', auth, async (request, reply) => {
    const { name, region, soil_type, climate_zone, city } = request.body
    const userId = request.user.userId

    // Приоритет координат: явные lat/lon → геокодинг city → regionCoords
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
      } catch (_) { /* геокодинг не обязателен — падаем в regionCoords */ }
    }
    if (lat == null || lon == null) {
      const coords = getCoordsForRegion(region)
      lat = coords.lat
      lon = coords.lon
    }

    const result = await fastify.db.query(
      `INSERT INTO gardens (user_id, name, lat, lon, region, soil_type, climate_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, name, lat, lon, region, soil_type ?? null, climate_zone ?? getZoneForRegion(region)]
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