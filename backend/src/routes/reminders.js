'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /reminders
  fastify.post('/', auth, async (request, reply) => {
    const { planting_id, remind_at, type, message } = request.body

    // Защита от IDOR: если напоминание привязано к посадке — она должна быть своей
    if (planting_id != null) {
      const owns = await fastify.db.query(
        `SELECT 1 FROM plantings p
         JOIN gardens g ON g.id = p.garden_id
         WHERE p.id = $1 AND g.user_id = $2`,
        [planting_id, request.user.userId]
      )
      if (owns.rows.length === 0) {
        return reply.code(403).send({ error: 'Planting not found or not yours' })
      }
    }

    const result = await fastify.db.query(
      `INSERT INTO reminders (user_id, planting_id, remind_at, type, message)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [request.user.userId, planting_id, remind_at, type, message]
    )
    return reply.code(201).send(result.rows[0])
  })

  // GET /reminders — предстоящие (и только что наступившие) напоминания.
  // Фильтр по remind_at: у напоминаний нет механизма «выполнено» (is_sent на сервере никто не
  // выставляет), поэтому без ограничения по дате давно прошедшие копились бы в списке навсегда.
  // Нижняя граница -1ч совпадает с окном GET /today, чтобы только что сработавшее ещё показывалось.
  fastify.get('/', auth, async (request) => {
    const result = await fastify.db.query(
      `SELECT r.*, p.id as planting_id, c.name as crop_name
       FROM reminders r
       LEFT JOIN plantings p ON p.id = r.planting_id
       LEFT JOIN crops c ON c.id = p.crop_id
       WHERE r.user_id=$1 AND r.is_sent=false
         AND r.remind_at >= NOW() - INTERVAL '1 hour'
       ORDER BY r.remind_at ASC`,
      [request.user.userId]
    )
    return result.rows
  })
}
