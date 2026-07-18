'use strict'

// pg возвращает DECIMAL как строку — нормализуем weight_kg в число
function normalizeHarvest(h) {
  return { ...h, weight_kg: h.weight_kg != null ? parseFloat(h.weight_kg) : null }
}

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // Проверка принадлежности посадки текущему пользователю
  async function userOwnsPlanting(plantingId, userId) {
    const res = await fastify.db.query(
      `SELECT 1 FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [plantingId, userId]
    )
    return res.rows.length > 0
  }

  // POST /harvests — свободно в рамках free-лимита посадок (гейт — на создании посадки, POST /plantings)
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { planting_id, weight_kg, quantity, notes } = request.body

    // Защита от IDOR: нельзя добавить урожай к чужой посадке
    if (!planting_id || !(await userOwnsPlanting(planting_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Planting not found or not yours' })
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
