'use strict'

// Справочник проблем растений: дефициты микроэлементов, болезни, вредители.
// GET — публичные (как /crops); POST/PUT — admin only.

module.exports = async function (fastify) {
  const adminAuth = { onRequest: [fastify.requireAdmin] }

  const ALLOWED_KINDS = new Set(['deficiency', 'disease', 'pest'])

  // GET /guide?kind=&crop_id=&q= — список (публичный)
  fastify.get('/', async (request, reply) => {
    const { kind, crop_id, q } = request.query
    const where = []
    const params = []

    if (kind) {
      if (!ALLOWED_KINDS.has(kind)) return reply.code(400).send({ error: 'Invalid kind' })
      params.push(kind)
      where.push(`e.kind = $${params.length}`)
    }
    if (crop_id) {
      params.push(parseInt(crop_id, 10))
      where.push(`EXISTS (SELECT 1 FROM crop_guide_entries cg WHERE cg.entry_id = e.id AND cg.crop_id = $${params.length})`)
    }
    if (q) {
      params.push(`%${q}%`)
      where.push(`e.search_text ILIKE $${params.length}`)
    }

    const sql = `SELECT e.id, e.slug, e.name, e.kind, e.element, e.category, e.danger,
                        e.symptoms, e.season, e.image_url
                 FROM guide_entries e
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY e.danger DESC NULLS LAST, e.name ASC`
    const result = await fastify.db.query(sql, params)
    return result.rows
  })

  // GET /guide/:slug — деталь + поражаемые культуры
  fastify.get('/:slug', async (request, reply) => {
    const entryRes = await fastify.db.query('SELECT * FROM guide_entries WHERE slug = $1', [request.params.slug])
    const entry = entryRes.rows[0]
    if (!entry) return reply.code(404).send({ error: 'Entry not found' })

    const cropsRes = await fastify.db.query(
      `SELECT c.id AS crop_id, c.name AS crop_name, cg.signs, cg.image_url
       FROM crop_guide_entries cg
       JOIN crops c ON c.id = cg.crop_id
       WHERE cg.entry_id = $1
       ORDER BY c.name ASC`,
      [entry.id]
    )
    return { ...entry, crops: cropsRes.rows }
  })

  // POST /guide — добавление записи (admin only)
  fastify.post('/', adminAuth, async (request, reply) => {
    const b = request.body || {}
    if (!b.slug || !b.name || !b.kind) return reply.code(400).send({ error: 'slug, name, kind required' })
    if (!ALLOWED_KINDS.has(b.kind)) return reply.code(400).send({ error: 'Invalid kind' })
    const result = await fastify.db.query(
      `INSERT INTO guide_entries
         (slug, name, kind, element, category, danger, description, symptoms,
          conditions, treatment, prevention, season, image_url, image_credit, search_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [b.slug, b.name, b.kind, b.element ?? null, b.category ?? null, b.danger ?? null,
       b.description ?? null, b.symptoms ?? null, b.conditions ?? null, b.treatment ?? null,
       b.prevention ?? null, b.season ?? null, b.image_url ?? null, b.image_credit ?? null,
       b.search_text ?? null]
    )
    return reply.code(201).send(result.rows[0])
  })

  // PUT /guide/:id — обновление записи (admin only)
  fastify.put('/:id', adminAuth, async (request, reply) => {
    const ALLOWED = [
      'slug', 'name', 'kind', 'element', 'category', 'danger', 'description',
      'symptoms', 'conditions', 'treatment', 'prevention', 'season',
      'image_url', 'image_credit', 'search_text'
    ]
    const sets = []
    const vals = []
    let i = 1
    for (const key of ALLOWED) {
      if (request.body[key] !== undefined) {
        if (key === 'kind' && !ALLOWED_KINDS.has(request.body[key])) {
          return reply.code(400).send({ error: 'Invalid kind' })
        }
        sets.push(`${key} = $${i++}`)
        vals.push(request.body[key])
      }
    }
    if (!sets.length) return reply.code(400).send({ error: 'Nothing to update' })
    vals.push(request.params.id)
    const result = await fastify.db.query(
      `UPDATE guide_entries SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Entry not found' })
    return result.rows[0]
  })
}
