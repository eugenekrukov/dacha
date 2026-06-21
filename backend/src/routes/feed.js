'use strict'

// Персональная лента «Мой участок»: сводный хронологический поток по всем
// посадкам пользователя — фото (planting_photos) + вехи сезона, выведенные из
// уже имеющихся данных (без отдельной таблицы событий).
//
// Вехи v1 (см. docs/superpowers/specs/2026-06-22-personal-feed-design.md):
//   sowing         — дата посадки (plantings.planted_at)
//   transplanted   — действие «высадка» (action_logs.action_type='transplanting')
//   first_harvest  — первая запись урожая (min harvests.harvested_at по посадке)
//   done           — завершение сезона (plantings.stage='done', дата ≈ updated_at)
//
// Лента приватная. Социальный слой (чужие ленты, видимость) подключается здесь же —
// это «шов» под будущую социализацию, поэтому сборка серверная, а не клиентская.

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /feed?limit=&offset= — единый поток, новые сверху.
  fastify.get('/', auth, async (request) => {
    const userId = request.user.userId
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(request.query.limit, 10) || DEFAULT_LIMIT))
    const offset = Math.max(0, parseInt(request.query.offset, 10) || 0)

    // Один UNION-запрос: БД сама сортирует и режет страницу по всем типам сразу.
    // ts приведён к timestamptz во всех ветках (planted_at — DATE), data — json.
    const res = await fastify.db.query(
      `SELECT type, ts, data FROM (
         SELECT 'photo' AS type, pp.taken_at::timestamptz AS ts,
                json_build_object(
                  'photo_id', pp.id, 'planting_id', pp.planting_id, 'crop_name', c.name,
                  'action_id', pp.action_id, 'action_type', al.action_type,
                  'caption', pp.caption
                ) AS data
         FROM planting_photos pp
         JOIN plantings p ON p.id = pp.planting_id
         JOIN gardens   g ON g.id = p.garden_id
         JOIN crops     c ON c.id = p.crop_id
         LEFT JOIN action_logs al ON al.id = pp.action_id
         WHERE g.user_id = $1

         UNION ALL
         SELECT 'milestone', p.planted_at::timestamptz,
                json_build_object('kind','sowing','planting_id',p.id,'crop_name',c.name)
         FROM plantings p
         JOIN gardens g ON g.id = p.garden_id
         JOIN crops   c ON c.id = p.crop_id
         WHERE g.user_id = $1 AND p.planted_at IS NOT NULL

         UNION ALL
         SELECT 'milestone', al.logged_at::timestamptz,
                json_build_object('kind','transplanted','planting_id',al.planting_id,'crop_name',c.name)
         FROM action_logs al
         JOIN plantings p ON p.id = al.planting_id
         JOIN gardens   g ON g.id = p.garden_id
         JOIN crops     c ON c.id = p.crop_id
         WHERE g.user_id = $1 AND al.action_type = 'transplanting'

         UNION ALL
         SELECT 'milestone', h.harvested_at::timestamptz,
                json_build_object('kind','first_harvest','planting_id',h.planting_id,
                                  'crop_name',c.name,'weight_kg',h.weight_kg)
         FROM harvests h
         JOIN (SELECT planting_id, MIN(harvested_at) AS first_at
               FROM harvests GROUP BY planting_id) f
           ON f.planting_id = h.planting_id AND f.first_at = h.harvested_at
         JOIN plantings p ON p.id = h.planting_id
         JOIN gardens   g ON g.id = p.garden_id
         JOIN crops     c ON c.id = p.crop_id
         WHERE g.user_id = $1

         UNION ALL
         SELECT 'milestone', p.updated_at::timestamptz,
                json_build_object('kind','done','planting_id',p.id,'crop_name',c.name)
         FROM plantings p
         JOIN gardens g ON g.id = p.garden_id
         JOIN crops   c ON c.id = p.crop_id
         WHERE g.user_id = $1 AND p.stage = 'done'
       ) feed
       ORDER BY ts DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    const items = res.rows.map((row) => {
      const data = row.data || {}
      // Нормализация и достройка полей, которые удобнее в JS, чем в SQL.
      if (row.type === 'photo') {
        data.url = `/photos/file/${data.photo_id}`
        data.thumb_url = `/photos/file/${data.photo_id}?thumb=1`
      }
      if (data.weight_kg != null) data.weight_kg = parseFloat(data.weight_kg)
      return { type: row.type, date: row.ts, ...data }
    })

    // hasMore выводим из заполненности страницы — без отдельного COUNT(*).
    const nextOffset = items.length === limit ? offset + limit : null
    return { items, next_offset: nextOffset }
  })
}
