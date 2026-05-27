'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /crops — справочник культур (публичный)
  fastify.get('/', async (request) => {
    const { category } = request.query
    let query = 'SELECT * FROM crops ORDER BY name ASC'
    const params = []
    if (category) {
      query = 'SELECT * FROM crops WHERE category = $1 ORDER BY name ASC'
      params.push(category)
    }
    const result = await fastify.db.query(query, params)
    return result.rows
  })

  // GET /crops/:id
  fastify.get('/:id', async (request, reply) => {
    const result = await fastify.db.query('SELECT * FROM crops WHERE id = $1', [request.params.id])
    if (!result.rows[0]) return reply.code(404).send({ error: 'Crop not found' })
    return result.rows[0]
  })

  // POST /crops — добавление в справочник (admin-use only, пока без guard)
  fastify.post('/', auth, async (request, reply) => {
    const { name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes } = request.body
    const result = await fastify.db.query(
      `INSERT INTO crops (name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes]
    )
    return reply.code(201).send(result.rows[0])
  })
}
