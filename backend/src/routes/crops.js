'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }
  const adminAuth = { onRequest: [fastify.requireAdmin] }

  // GET /crops вЂ” СЃРїСЂР°РІРѕС‡РЅРёРє РєСѓР»СЊС‚СѓСЂ (РїСѓР±Р»РёС‡РЅС‹Р№)
  fastify.get('/', async (request) => {
    const { category } = request.query
    // DISTINCT ON (name) РёСЃРєР»СЋС‡Р°РµС‚ РґСѓР±Р»РёРєР°С‚С‹ РЅР° СЃР»СѓС‡Р°Р№ РїРѕРІС‚РѕСЂРЅРѕРіРѕ Р·Р°РїСѓСЃРєР° РјРёРіСЂР°С†РёР№
    let query = `SELECT DISTINCT ON (name) * FROM crops ORDER BY name ASC`
    const params = []
    if (category) {
      query = `SELECT DISTINCT ON (name) * FROM crops WHERE category = $1 ORDER BY name ASC`
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

  // POST /crops вЂ” РґРѕР±Р°РІР»РµРЅРёРµ РІ СЃРїСЂР°РІРѕС‡РЅРёРє (admin-use only, РїРѕРєР° Р±РµР· guard)
  fastify.post('/', adminAuth, async (request, reply) => {
    const { name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes } = request.body
    const result = await fastify.db.query(
      `INSERT INTO crops (name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, sowing_start_day, sowing_end_day, transplant_days, harvest_days, watering_freq_days, frost_sensitive, companion_crops, notes]
    )
    return reply.code(201).send(result.rows[0])
  })

  // PUT /crops/:id вЂ” РѕР±РЅРѕРІР»РµРЅРёРµ РєСѓР»СЊС‚СѓСЂС‹ (admin-use only)
  fastify.put('/:id', adminAuth, async (request, reply) => {
    const ALLOWED = [
      'name', 'category', 'sowing_start_day', 'sowing_end_day', 'transplant_days',
      'harvest_days', 'watering_freq_days', 'frost_sensitive', 'notes',
      'climate_zones', 'watering_details', 'fertilizing_schedule',
      'diseases', 'pests', 'good_neighbors', 'bad_neighbors', 'good_predecessors'
    ]
    const JSONB_FIELDS = new Set([
      'climate_zones', 'watering_details', 'fertilizing_schedule', 'diseases', 'pests'
    ])
    const sets = []
    const vals = []
    let i = 1
    for (const key of ALLOWED) {
      if (request.body[key] !== undefined) {
        sets.push(`${key} = $${i++}`)
        const val = request.body[key]
        vals.push(JSONB_FIELDS.has(key) && typeof val === 'object' ? JSON.stringify(val) : val)
      }
    }
    if (!sets.length) return reply.code(400).send({ error: 'Nothing to update' })
    vals.push(request.params.id)
    const result = await fastify.db.query(
      `UPDATE crops SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Crop not found' })
    return result.rows[0]
  })
}

