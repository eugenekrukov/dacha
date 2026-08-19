'use strict'

const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')

// pg возвращает DECIMAL как строку — нормализуем weight_kg в число
function normalizeHarvest(h) {
  return { ...h, weight_kg: h.weight_kg != null ? parseFloat(h.weight_kg) : null }
}

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // Своя посадка ({id, stage}) или null — нужна и для IDOR-проверки, и для гейта read-only.
  async function getOwnedPlanting(plantingId, userId) {
    const res = await fastify.db.query(
      `SELECT p.id, p.stage FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [plantingId, userId]
    )
    return res.rows[0] || null
  }

  // POST /harvests — свободно по посадкам free-набора; заблокированные (сверх лимита, без
  // подписки) только для чтения — см. isPlantingLocked.
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { planting_id, weight_kg, quantity, notes } = request.body

    if (weight_kg != null && !(Number(weight_kg) >= 0)) {
      return reply.code(400).send({ error: 'Invalid weight_kg' })
    }
    if (quantity != null && !(Number(quantity) >= 0)) {
      return reply.code(400).send({ error: 'Invalid quantity' })
    }

    // Защита от IDOR: нельзя добавить урожай к чужой посадке
    const planting = planting_id ? await getOwnedPlanting(planting_id, request.user.userId) : null
    if (!planting) {
      return reply.code(403).send({ error: 'Planting not found or not yours' })
    }

    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }

    const result = await fastify.db.query(
      `INSERT INTO harvests (planting_id, weight_kg, quantity, notes, harvested_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [planting_id, weight_kg, quantity, notes]
    )
    return reply.code(201).send(normalizeHarvest(result.rows[0]))
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
    return result.rows.map(normalizeHarvest)
  })
}
