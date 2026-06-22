'use strict'

// Персональная лента «Мой участок»: сводный хронологический поток по всем
// посадкам пользователя. Запись-центричная модель (см.
// docs/superpowers/specs/2026-06-22-unified-journal-entry-design.md):
//   action    — действие + ручная заметка + агрегированные привязанные фото (одна карточка).
//               В глобальной ленте показываем только «содержательные» действия:
//               есть привязанное фото ИЛИ ручная непустая заметка (auto-действия
//               и пустые ручные отметки не засоряют ленту).
//   photo     — одиночное фото без действия (planting_photos.action_id IS NULL).
//   milestone — веха сезона, выведенная из имеющихся данных:
//     sowing         — дата посадки (plantings.planted_at)
//     first_harvest  — первая запись урожая (min harvests.harvested_at по посадке)
//     done           — завершение сезона (plantings.stage='done', дата ≈ updated_at)
//   Веха transplanted убрана: «высадка» — обычное действие transplanting и
//   показывается как action-запись (иначе дубль).
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
         -- Действия: ручная заметка (null если auto/пусто) + агрегированные привязанные фото.
         -- Фильтр: показываем только содержательные — с фото ИЛИ ручной непустой заметкой.
         SELECT 'action' AS type, al.logged_at::timestamptz AS ts,
                json_build_object(
                  'action_id', al.id, 'action_type', al.action_type,
                  'note', CASE WHEN al.auto OR al.notes IS NULL OR btrim(al.notes) = ''
                               THEN NULL ELSE al.notes END,
                  'planting_id', al.planting_id, 'crop_name', c.name,
                  'photos', COALESCE((
                    SELECT json_agg(json_build_object('photo_id', pp.id) ORDER BY pp.taken_at)
                    FROM planting_photos pp WHERE pp.action_id = al.id), '[]'::json)
                ) AS data
         FROM action_logs al
         JOIN plantings p ON p.id = al.planting_id
         JOIN gardens   g ON g.id = p.garden_id
         JOIN crops     c ON c.id = p.crop_id
         WHERE g.user_id = $1
           AND (
             EXISTS (SELECT 1 FROM planting_photos pp WHERE pp.action_id = al.id)
             OR (al.auto = false AND al.notes IS NOT NULL AND btrim(al.notes) <> '')
           )

         UNION ALL  -- одиночные фото (без привязки к действию)
         SELECT 'photo', pp.taken_at::timestamptz,
                json_build_object(
                  'photo_id', pp.id, 'planting_id', pp.planting_id, 'crop_name', c.name,
                  'caption', pp.caption
                )
         FROM planting_photos pp
         JOIN plantings p ON p.id = pp.planting_id
         JOIN gardens   g ON g.id = p.garden_id
         JOIN crops     c ON c.id = p.crop_id
         WHERE g.user_id = $1 AND pp.action_id IS NULL

         UNION ALL  -- веха: посев
         SELECT 'milestone', p.planted_at::timestamptz,
                json_build_object('kind','sowing','planting_id',p.id,'crop_name',c.name)
         FROM plantings p
         JOIN gardens g ON g.id = p.garden_id
         JOIN crops   c ON c.id = p.crop_id
         WHERE g.user_id = $1 AND p.planted_at IS NOT NULL

         UNION ALL  -- веха: первый урожай
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

         UNION ALL  -- веха: завершение сезона
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

    const photoUrls = (id) => ({ url: `/photos/file/${id}`, thumb_url: `/photos/file/${id}?thumb=1` })

    const items = res.rows.map((row) => {
      const data = row.data || {}
      // Нормализация и достройка полей, которые удобнее в JS, чем в SQL.
      if (row.type === 'action') {
        data.photos = (data.photos || []).map((ph) => ({ photo_id: ph.photo_id, ...photoUrls(ph.photo_id) }))
      }
      if (row.type === 'photo') {
        Object.assign(data, photoUrls(data.photo_id))
      }
      if (data.weight_kg != null) data.weight_kg = parseFloat(data.weight_kg)
      return { type: row.type, date: row.ts, ...data }
    })

    // hasMore выводим из заполненности страницы — без отдельного COUNT(*).
    const nextOffset = items.length === limit ? offset + limit : null
    return { items, next_offset: nextOffset }
  })
}
