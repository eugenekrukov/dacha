'use strict'

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

  // POST /actions — платное действие: гейт по триалу/подписке
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async (request, reply) => {
    const { planting_id, notes } = request.body
    const action_type = request.body.action_type ?? request.body.type
    const auto = request.body.auto === true // заметка подставлена автоматически (не введена юзером)

    // Защита от IDOR: нельзя писать в журнал чужой посадки
    if (!planting_id || !(await userOwnsPlanting(planting_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Planting not found or not yours' })
    }

    const result = await fastify.db.query(
      `INSERT INTO action_logs (planting_id, action_type, notes, auto, logged_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [planting_id, action_type, notes, auto]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /actions?planting_id=&limit=
  fastify.get('/', auth, async (request) => {
    const { planting_id, limit = 100 } = request.query
    const result = await fastify.db.query(
      `SELECT al.*, c.name AS crop_name
       FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN crops c     ON c.id = p.crop_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1 ${planting_id ? 'AND al.planting_id = $2' : ''}
       ORDER BY al.logged_at DESC
       LIMIT $${planting_id ? 3 : 2}`,
      planting_id ? [request.user.userId, planting_id, limit] : [request.user.userId, limit]
    )
    return result.rows
  })

  // DELETE /actions/:id
  fastify.delete('/:id', auth, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    // Проверяем что запись принадлежит текущему пользователю
    const check = await fastify.db.query(
      `SELECT al.id FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE al.id = $1 AND g.user_id = $2`,
      [id, request.user.userId]
    )
    if (check.rowCount === 0) return reply.code(404).send({ error: 'Не найдено' })
    await fastify.db.query('DELETE FROM action_logs WHERE id = $1', [id])
    return reply.code(204).send()
  })

  // GET /actions/export
  fastify.get('/export', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `SELECT
         al.logged_at,
         c.name        AS crop_name,
         al.action_type,
         al.notes
       FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN crops c     ON c.id = p.crop_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1
       ORDER BY al.logged_at DESC`,
      [request.user.userId]
    )

    const header = 'Дата,Культура,Действие,Заметки'
    const rows = result.rows.map(r => {
      const date = new Date(r.logged_at).toLocaleDateString('ru-RU')
      const notes = (r.notes ?? '').replace(/"/g, '""')
      return `${date},"${r.crop_name}","${r.action_type}","${notes}"`
    })
    const csv = [header, ...rows].join('\n')

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="actions.csv"')
      .send('﻿' + csv)
  })
}
