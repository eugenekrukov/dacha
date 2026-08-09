'use strict'

const fsPromises = require('fs/promises')
const path = require('path')
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')

const PHOTO_LIMIT_FREE = 3
const PHOTO_LIMIT_PAID = 30
const PHOTO_CAP_ACCOUNT = 1000

module.exports = async function (fastify, opts) {
  const imageService = opts.imageService || require('../services/imageService')
  const aiDiagnosisService = opts.aiDiagnosisService || require('../services/aiDiagnosisService')
  const fsImpl = opts.fsPromises || fsPromises
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
    const planting = await getOwnedPlanting(plantingId, userId)
    if (!planting) {
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

    // Заблокированная посадка (сверх free-набора, без подписки) — только для чтения.
    const state = await freeTierState(fastify.db, userId)
    if (isPlantingLocked(state, planting)) {
      try { await data.toBuffer() } catch {}
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }

    const limit = state.paid ? PHOTO_LIMIT_PAID : PHOTO_LIMIT_FREE

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
      `SELECT pp.id, pp.planting_id, pp.action_id, pp.caption, pp.taken_at, pp.width, pp.height, pp.ai_diagnosis, pp.ai_diagnosed_at FROM planting_photos pp
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

  // POST /photos/:id/diagnose — AI-диагноз (closed-set по culture, F2, «Дачник Про»).
  fastify.post('/:id/diagnose', auth, async (request, reply) => {
    if (!aiDiagnosisService.isEnabled()) {
      return reply.code(503).send({ error: 'ai_diagnosis_unavailable' })
    }

    const userId = request.user.userId
    const state = await freeTierState(fastify.db, userId)
    if (!state.paid) {
      return reply.code(402).send({ error: 'subscription_required' })
    }

    const id = parseInt(request.params.id, 10)
    const found = await fastify.db.query(
      `SELECT pp.file_path, pp.planting_id, p.crop_id, c.name AS crop_name
       FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       JOIN crops c     ON c.id = p.crop_id
       WHERE pp.id = $1 AND g.user_id = $2`,
      [id, userId]
    )
    const photo = found.rows[0]
    if (!photo) return reply.code(404).send({ error: 'not_found' })

    // Closed-set кандидаты: болезни/вредители ИМЕННО этой культуры (тот же JOIN, что в guide.js).
    const guideRes = await fastify.db.query(
      `SELECT e.id, e.name, e.kind
       FROM guide_entries e
       JOIN crop_guide_entries cg ON cg.entry_id = e.id AND cg.crop_id = $1
       WHERE e.kind IN ('disease', 'pest')`,
      [photo.crop_id]
    )
    if (guideRes.rows.length === 0) {
      return reply.code(422).send({ error: 'no_guide_entries_for_crop' })
    }

    const mediaDir = process.env.MEDIA_DIR || '/var/www/dacha-media'
    let imageBuffer
    try {
      imageBuffer = await fsImpl.readFile(path.join(mediaDir, photo.file_path))
    } catch {
      return reply.code(500).send({ error: 'photo_file_missing' })
    }

    const result = await aiDiagnosisService.diagnose({
      imageBuffer,
      cropName: photo.crop_name,
      candidates: guideRes.rows
    })

    const diagnosedAt = new Date()
    await fastify.db.query(
      'UPDATE planting_photos SET ai_diagnosis = $1, ai_diagnosed_at = $2 WHERE id = $3',
      [JSON.stringify(result.candidates), diagnosedAt, id]
    )

    return reply.code(200).send({
      candidates: result.candidates,
      disclaimer: 'Предварительная оценка ИИ — не заменяет консультацию агронома. Сверьтесь со справочником.',
      diagnosed_at: diagnosedAt
    })
  })
}
