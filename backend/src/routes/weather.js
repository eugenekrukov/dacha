'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /weather?garden_id=
  fastify.get('/', auth, async (request, reply) => {
    const { garden_id } = request.query
    if (!garden_id) return reply.code(400).send({ error: 'garden_id required' })

    // Проверяем принадлежность участка
    const garden = await fastify.db.query(
      'SELECT * FROM gardens WHERE id=$1 AND user_id=$2',
      [garden_id, request.user.userId]
    )
    if (!garden.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    // Возвращаем последний кэшированный снимок (не старше 3 часов)
    const snapshot = await fastify.db.query(
      `SELECT * FROM weather_snapshots
       WHERE garden_id=$1 AND fetched_at > NOW() - INTERVAL '3 hours'
       ORDER BY fetched_at DESC LIMIT 1`,
      [garden_id]
    )

    if (snapshot.rows[0]) return snapshot.rows[0]

    // Если кэш устарел — возвращаем последний доступный (фоновый джоб обновит)
    const lastSnapshot = await fastify.db.query(
      'SELECT * FROM weather_snapshots WHERE garden_id=$1 ORDER BY fetched_at DESC LIMIT 1',
      [garden_id]
    )
    return lastSnapshot.rows[0] || { message: 'Weather data not yet available' }
  })
}
