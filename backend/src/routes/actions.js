'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /actions
  fastify.post('/', auth, async (request, reply) => {
    const { planting_id, notes } = request.body
    const action_type = request.body.action_type ?? request.body.type
    const result = await fastify.db.query(
      `INSERT INTO action_logs (planting_id, action_type, notes, logged_at)
       VALUES ($1,$2,$3,NOW()) RETURNING *`,
      [planting_id, action_type, notes]
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
