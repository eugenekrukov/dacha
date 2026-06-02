'use strict'

// pg возвращает DECIMAL как строку — нормализуем числовые поля погоды
function normalizeWeather(w) {
  if (!w) return w
  return {
    ...w,
    temp_c:      w.temp_c      != null ? parseFloat(w.temp_c)      : null,
    min_temp_c:  w.min_temp_c  != null ? parseFloat(w.min_temp_c)  : null,
    max_temp_c:  w.max_temp_c  != null ? parseFloat(w.max_temp_c)  : null,
    humidity_pct: w.humidity_pct != null ? parseInt(w.humidity_pct) : null,
    wind_ms:     w.wind_ms     != null ? parseFloat(w.wind_ms)     : null,
    precip_mm:   w.precip_mm   != null ? parseFloat(w.precip_mm)   : null,
  }
}

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

    if (snapshot.rows[0]) return normalizeWeather(snapshot.rows[0])

    // Если кэш устарел — возвращаем последний доступный (фоновый джоб обновит)
    const lastSnapshot = await fastify.db.query(
      'SELECT * FROM weather_snapshots WHERE garden_id=$1 ORDER BY fetched_at DESC LIMIT 1',
      [garden_id]
    )
    return normalizeWeather(lastSnapshot.rows[0]) || { message: 'Weather data not yet available' }
  })
}
