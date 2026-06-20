'use strict'

const { isSubscribed, hasPromo, isAdSupportedStore } = require('../utils/access')

const PHOTO_LIMIT_FREE = 3
const PHOTO_LIMIT_PAID = 30
const PHOTO_CAP_ACCOUNT = 1000

function isPaidTier(user) {
  return !!user && (isSubscribed(user.subscription_until) || hasPromo(user.promo_until) || isAdSupportedStore(user.store))
}

module.exports = async function (fastify, opts) {
  const imageService = opts.imageService || require('../services/imageService')
  const auth = { onRequest: [fastify.authenticate] }

  async function userOwnsPlanting(plantingId, userId) {
    const res = await fastify.db.query(
      `SELECT 1 FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [plantingId, userId]
    )
    return res.rows.length > 0
  }

  // POST /photos — multipart: planting_id, [action_id], [caption], [taken_at], file
  fastify.post('/', auth, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'file_required' })

    const fields = data.fields || {}
    const plantingId = parseInt(fields.planting_id && fields.planting_id.value, 10)
    const actionId = fields.action_id && fields.action_id.value ? parseInt(fields.action_id.value, 10) : null
    const caption = fields.caption && fields.caption.value ? String(fields.caption.value) : null
    const takenAtField = fields.taken_at && fields.taken_at.value ? fields.taken_at.value : null
    const userId = request.user.userId

    if (!plantingId) return reply.code(400).send({ error: 'planting_id_required' })
    if (!(await userOwnsPlanting(plantingId, userId))) {
      try { await data.toBuffer() } catch {}
      return reply.code(403).send({ error: 'Planting not found or not yours' })
    }

    if (actionId) {
      const a = await fastify.db.query('SELECT 1 FROM action_logs WHERE id = $1 AND planting_id = $2', [actionId, plantingId])
      if (a.rows.length === 0) {
        try { await data.toBuffer() } catch {}
        return reply.code(400).send({ error: 'action_not_in_planting' })
      }
    }

    const accessRes = await fastify.db.query(
      'SELECT trial_started_at, subscription_until, promo_until, store FROM users WHERE id = $1', [userId])
    const limit = isPaidTier(accessRes.rows[0]) ? PHOTO_LIMIT_PAID : PHOTO_LIMIT_FREE

    const perPlanting = await fastify.db.query('SELECT COUNT(*) FROM planting_photos WHERE planting_id = $1', [plantingId])
    if (parseInt(perPlanting.rows[0].count, 10) >= limit) {
      try { await data.toBuffer() } catch {}
      return reply.code(409).send({ code: 'photo_limit_reached', limit })
    }

    const account = await fastify.db.query(
      `SELECT COUNT(*) FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1`, [userId])
    if (parseInt(account.rows[0].count, 10) >= PHOTO_CAP_ACCOUNT) {
      try { await data.toBuffer() } catch {}
      return reply.code(409).send({ code: 'account_cap_reached', limit: PHOTO_CAP_ACCOUNT })
    }

    const buffer = await data.toBuffer()
    const meta = await imageService.process(buffer, { plantingId })
    const takenAt = takenAtField || meta.taken_at || new Date()

    const result = await fastify.db.query(
      `INSERT INTO planting_photos (planting_id, action_id, file_path, caption, taken_at, width, height, bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [plantingId, actionId, meta.file_path, caption, takenAt, meta.width, meta.height, meta.bytes]
    )
    const row = result.rows[0]
    return reply.code(201).send({
      ...row,
      url: `/photos/file/${row.id}`,
      thumb_url: `/photos/file/${row.id}?thumb=1`
    })
  })

  // GET /photos?planting_id= — лента посадки (по владельцу), сорт по дате съёмки.
  fastify.get('/', auth, async (request) => {
    const { planting_id } = request.query
    const params = [request.user.userId]
    const conds = []
    if (planting_id) { params.push(planting_id); conds.push(`pp.planting_id = $${params.length}`) }
    const res = await fastify.db.query(
      `SELECT pp.id, pp.planting_id, pp.action_id, pp.caption, pp.taken_at, pp.width, pp.height FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1 ${conds.length ? 'AND ' + conds.join(' AND ') : ''}
       ORDER BY pp.taken_at DESC`,
      params
    )
    return res.rows.map(({ file_path, ...r }) => ({ ...r, url: `/photos/file/${r.id}`, thumb_url: `/photos/file/${r.id}?thumb=1` }))
  })

  // DELETE /photos/:id — удалить своё фото (строка + файлы).
  fastify.delete('/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const found = await fastify.db.query(
      `SELECT pp.file_path FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE pp.id = $1 AND g.user_id = $2`,
      [id, request.user.userId]
    )
    if (found.rows.length === 0) return reply.code(404).send({ error: 'not_found' })
    await imageService.remove(found.rows[0].file_path)
    await fastify.db.query('DELETE FROM planting_photos WHERE id = $1', [id])
    return reply.code(204).send()
  })

  // GET /photos/file/:id[?thumb=1] — приватная отдача байтов через X-Accel-Redirect.
  // Авторизуем в Node, сами байты отдаёт nginx из internal-локации /media-internal/.
  fastify.get('/file/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const found = await fastify.db.query(
      `SELECT pp.file_path FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE pp.id = $1 AND g.user_id = $2`,
      [id, request.user.userId]
    )
    if (found.rows.length === 0) return reply.code(404).send({ error: 'not_found' })
    let rel = found.rows[0].file_path
    if (request.query.thumb) rel = imageService.thumbPath(rel)
    reply.header('X-Accel-Redirect', `/media-internal/${rel}`)
    reply.header('Content-Type', 'image/webp')
    return reply.send()
  })
}
