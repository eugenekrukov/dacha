'use strict'

const { getCoordsForRegion, getZoneForRegion } = require('../utils/regionCoords')
const { updateGardenWeather } = require('../services/weatherService')

async function geocodeCity(city) {
  try {
    const q = encodeURIComponent(city + ', Россия')
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'DachaKalendar/1.0 (support@dacha.studio1008.com)' } }
    )
    const data = await resp.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    }
  } catch (_) {}
  return null
}

// pg возвращает DECIMAL-колонки как строки — нормализуем в числа
function normalizeGarden(g) {
  return {
    ...g,
    lat: g.lat != null ? parseFloat(g.lat) : null,
    lon: g.lon != null ? parseFloat(g.lon) : null,
  }
}

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /gardens
  // Бесплатный план: максимум 3 участка.
  // Если участок уже есть — возвращаем первый существующий вместо создания нового.
  fastify.post('/', auth, async (request, reply) => {
    const { name, region, soil_type, climate_zone, city, garden_type } = request.body
    const userId = request.user.userId

    // Проверяем лимит участков
    const existing = await fastify.db.query(
      'SELECT * FROM gardens WHERE user_id=$1 ORDER BY created_at ASC LIMIT 3',
      [userId]
    )
    if (existing.rows.length >= 3) {
      return reply.code(409).send({
        error: 'Достигнут лимит участков',
        existing_garden: existing.rows[0]
      })
    }

    let lat = request.body.lat
    let lon = request.body.lon

    // Приоритет координат: явные lat/lon → геокодинг city → regionCoords
    if (lat == null || lon == null) {
      if (city) {
        const coords = await geocodeCity(city)
        if (coords) { lat = coords.lat; lon = coords.lon }
      }
    }
    if (lat == null || lon == null) {
      const coords = getCoordsForRegion(region)
      lat = coords.lat
      lon = coords.lon
    }

    const result = await fastify.db.query(
      `INSERT INTO gardens (user_id, name, lat, lon, region, soil_type, climate_zone, garden_type, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, name, lat, lon, region, soil_type ?? null,
       climate_zone ?? getZoneForRegion(region), garden_type ?? 'soil', city ?? null]
    )
    const garden = result.rows[0]

    if (lat && lon) {
      updateGardenWeather(fastify.db, garden).catch(() => {})
    }

    return reply.code(201).send(normalizeGarden(garden))
  })

  // GET /gardens
  fastify.get('/', auth, async (request) => {
    const result = await fastify.db.query(
      `SELECT g.*, COUNT(p.id) AS planting_count
       FROM gardens g
       LEFT JOIN plantings p ON p.garden_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY planting_count DESC, g.created_at ASC`,
      [request.user.userId]
    )
    return result.rows.map(g => ({
      ...normalizeGarden(g),
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
    return normalizeGarden(result.rows[0])
  })

  // PUT /gardens/:id
  fastify.put('/:id', auth, async (request, reply) => {
    const { name, region, soil_type, climate_zone, city, garden_type } = request.body

    let lat = request.body.lat
    let lon = request.body.lon

    if (lat == null || lon == null) {
      if (city) {
        const coords = await geocodeCity(city)
        if (coords) { lat = coords.lat; lon = coords.lon }
      }
    }
    if (lat == null || lon == null) {
      const coords = getCoordsForRegion(region)
      lat = coords.lat
      lon = coords.lon
    }

    const result = await fastify.db.query(
      `UPDATE gardens
       SET name=$1, lat=$2, lon=$3, region=$4, soil_type=$5, climate_zone=$6,
           garden_type=$7, city=$8, updated_at=NOW()
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [name, lat, lon, region, soil_type,
       climate_zone ?? getZoneForRegion(region),
       garden_type ?? 'soil', city ?? null,
       request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Garden not found' })
    return normalizeGarden(result.rows[0])
  })

  // GET /gardens/:id/beds — грядки участка + история посадок за 3 года (для подсказки севооборота)
  fastify.get('/:id/beds', auth, async (request, reply) => {
    const garden = await fastify.db.query(
      'SELECT id FROM gardens WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!garden.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    const result = await fastify.db.query(
      `SELECT b.id, b.name, b.type,
              COALESCE((
                SELECT json_agg(json_build_object(
                         'crop_name', c.name, 'family', c.family,
                         'year', EXTRACT(YEAR FROM p.planted_at)::int
                       ) ORDER BY p.planted_at DESC)
                FROM plantings p
                JOIN crops c ON c.id = p.crop_id
                WHERE p.bed_id = b.id AND p.planted_at >= NOW() - INTERVAL '3 years'
              ), '[]'::json) AS history
       FROM garden_beds b
       WHERE b.garden_id = $1
       ORDER BY b.created_at ASC`,
      [request.params.id]
    )
    return result.rows
  })

  // POST /gardens/:id/beds — создать грядку
  fastify.post('/:id/beds', auth, async (request, reply) => {
    const garden = await fastify.db.query(
      'SELECT id FROM gardens WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!garden.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    const { name, type } = request.body
    if (type !== undefined && type !== 'soil' && type !== 'greenhouse') {
      return reply.code(400).send({ error: 'Invalid type' })
    }
    const bedType = type ?? 'soil'
    const result = await fastify.db.query(
      'INSERT INTO garden_beds (garden_id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [request.params.id, name, bedType]
    )
    return reply.code(201).send({ ...result.rows[0], history: [] })
  })
}
