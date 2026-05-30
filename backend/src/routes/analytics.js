'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /analytics/summary — метрики для экрана аналитики
  // Возвращает:
  //   streak          — текущая серия активных дней подряд
  //   total_actions   — всего действий
  //   total_harvests  — всего сборов урожая
  //   activity_by_day — активность за последние 30 дней (дата → кол-во)
  //   onboarding      — прогресс онбординга (garden, planting, action, harvest)
  fastify.get('/summary', auth, async (request) => {
    const userId = request.user.userId

    // --- Активность за 30 дней ---
    const activityRes = await fastify.db.query(
      `SELECT DATE(al.logged_at) AS day, COUNT(*)::int AS count
       FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1
         AND al.logged_at >= NOW() - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day`,
      [userId]
    )

    // --- Streak (дней подряд до сегодня включительно) ---
    const allDaysRes = await fastify.db.query(
      `SELECT DISTINCT DATE(al.logged_at) AS day
       FROM action_logs al
       JOIN plantings p ON p.id = al.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1
       ORDER BY day DESC`,
      [userId]
    )
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const row of allDaysRes.rows) {
      const d = new Date(row.day)
      d.setHours(0, 0, 0, 0)
      const diff = Math.round((today - d) / 86400000)
      if (diff === streak) streak++
      else break
    }

    // --- Итоговые счётчики ---
    const totalsRes = await fastify.db.query(
      `SELECT
         (SELECT COUNT(*) FROM action_logs al
          JOIN plantings p ON p.id = al.planting_id
          JOIN gardens g   ON g.id = p.garden_id
          WHERE g.user_id = $1)::int AS total_actions,
         (SELECT COUNT(*) FROM harvests h
          JOIN plantings p ON p.id = h.planting_id
          JOIN gardens g   ON g.id = p.garden_id
          WHERE g.user_id = $1)::int AS total_harvests`,
      [userId]
    )

    // --- Онбординг-прогресс ---
    const onbRes = await fastify.db.query(
      `SELECT
         EXISTS(SELECT 1 FROM gardens    WHERE user_id = $1)        AS has_garden,
         EXISTS(SELECT 1 FROM plantings p
                JOIN gardens g ON g.id = p.garden_id
                WHERE g.user_id = $1)                               AS has_planting,
         EXISTS(SELECT 1 FROM action_logs al
                JOIN plantings p ON p.id = al.planting_id
                JOIN gardens g   ON g.id = p.garden_id
                WHERE g.user_id = $1)                               AS has_action,
         EXISTS(SELECT 1 FROM harvests h
                JOIN plantings p ON p.id = h.planting_id
                JOIN gardens g   ON g.id = p.garden_id
                WHERE g.user_id = $1)                               AS has_harvest`,
      [userId]
    )

    const { total_actions, total_harvests } = totalsRes.rows[0]
    const onb = onbRes.rows[0]

    return {
      streak,
      total_actions,
      total_harvests,
      activity_by_day: activityRes.rows.map(r => ({
        date: r.day.toISOString().slice(0, 10),
        count: r.count
      })),
      onboarding: {
        garden:   onb.has_garden,
        planting: onb.has_planting,
        action:   onb.has_action,
        harvest:  onb.has_harvest
      }
    }
  })
}
