'use strict'

// Инвентарь семян: культура + сорт + фото пакетика + срок годности.
// Смысл фичи — не покупать второй раз то, что уже лежит в коробке, и вовремя
// заметить просроченный пакетик. Гейта подписки нет; ограничение — только
// потолок числа записей на аккаунт (фото занимают место на диске).

const SEEDS_CAP_ACCOUNT = 200

/**
 * Срок годности с пакетика приходит либо датой (`2027-12-31`), либо месяцем (`2027-12`) —
 * на пакетиках пишут «годен до 12.2027». Месяц нормализуем в последний его день, чтобы
 * пакетик не считался просроченным в первое же число.
 * Возвращает 'YYYY-MM-DD', null (сняли срок) или undefined при мусоре на входе.
 */
function normalizeExpiry(value) {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const month = value.match(/^(\d{4})-(\d{2})$/)
  if (month) {
    const y = Number(month[1])
    const m = Number(month[2])
    if (m < 1 || m > 12) return undefined
    return `${month[1]}-${month[2]}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`
  }
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!date) return undefined
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(date[3])) return undefined
  return value
}

// Поля срока годности считаем в SQL, а не на клиентах: иначе одна и та же
// арифметика дублировалась бы в вебе и в Android.
// to_char, а не голая колонка: pg отдаёт DATE как JS Date в локальной зоне, и JSON.stringify
// сдвигает её в UTC (в MSK «2027-12-31» уезжает на 2027-12-30T21:00Z). Клиентам нужна
// именно календарная дата с пакетика — отдаём строкой.
const SELECT_FIELDS = `
  s.id, s.crop_name, s.variety, to_char(s.expires_on, 'YYYY-MM-DD') AS expires_on, s.created_at,
  (s.photo_path IS NOT NULL) AS has_photo,
  (s.expires_on IS NOT NULL AND s.expires_on < CURRENT_DATE) AS expired,
  (s.expires_on IS NOT NULL AND s.expires_on >= CURRENT_DATE
     AND s.expires_on < date_trunc('year', CURRENT_DATE) + INTERVAL '1 year') AS expires_this_year`

function withUrls(row) {
  const { has_photo, ...rest } = row
  return {
    ...rest,
    photo_url: has_photo ? `/seeds/${row.id}/photo` : null,
    thumb_url: has_photo ? `/seeds/${row.id}/photo?thumb=1` : null
  }
}

module.exports = async function (fastify, opts) {
  const imageService = opts.imageService || require('../services/imageService')
  const auth = { onRequest: [fastify.authenticate] }

  // GET /seeds — вся коробка пользователя. Просроченные сверху: ради них экран и открывают.
  fastify.get('/', auth, async (request) => {
    const res = await fastify.db.query(
      `SELECT ${SELECT_FIELDS} FROM seeds s
       WHERE s.user_id = $1
       ORDER BY (s.expires_on IS NOT NULL AND s.expires_on < CURRENT_DATE) DESC,
                s.crop_name ASC, s.id ASC`,
      [request.user.userId]
    )
    return res.rows.map(withUrls)
  })

  // GET /seeds/shopping-list — культуры из активных посадок (stage <> 'done'), для которых
  // нет непросроченной записи в инвентаре семян. Сопоставление по названию (не по id):
  // seeds.crop_name — свободный текст, ради цветов, которых нет в справочнике crops, строгого
  // FK нет. ponytail: текстового сравнения достаточно, пока форма подбирает культуру из
  // datalist с теми же названиями (SeedsScreen); если совпадения станут ненадёжными
  // (опечатки при свободном вводе) — заводить seeds.crop_id.
  fastify.get('/shopping-list', auth, async (request) => {
    const res = await fastify.db.query(
      `SELECT DISTINCT c.id AS crop_id, c.name AS crop_name
       FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       JOIN crops c ON c.id = p.crop_id
       WHERE g.user_id = $1 AND p.stage <> 'done'
         AND NOT EXISTS (
           SELECT 1 FROM seeds s
           WHERE s.user_id = $1
             AND LOWER(TRIM(s.crop_name)) = LOWER(c.name)
             AND (s.expires_on IS NULL OR s.expires_on >= CURRENT_DATE)
         )
       ORDER BY c.name`,
      [request.user.userId]
    )
    return res.rows
  })

  // POST /seeds — { crop_name, variety?, expires_on? } (фото отдельным запросом)
  fastify.post('/', auth, async (request, reply) => {
    const { crop_name, variety } = request.body || {}
    if (!crop_name || !String(crop_name).trim()) {
      return reply.code(400).send({ error: 'crop_name_required' })
    }
    const expiresOn = normalizeExpiry(request.body?.expires_on ?? null)
    if (expiresOn === undefined) return reply.code(400).send({ error: 'invalid_expires_on' })

    const count = await fastify.db.query('SELECT COUNT(*) FROM seeds WHERE user_id = $1', [request.user.userId])
    if (parseInt(count.rows[0].count, 10) >= SEEDS_CAP_ACCOUNT) {
      return reply.code(409).send({ code: 'seeds_cap_reached', limit: SEEDS_CAP_ACCOUNT })
    }

    const res = await fastify.db.query(
      `INSERT INTO seeds (user_id, crop_name, variety, expires_on) VALUES ($1,$2,$3,$4) RETURNING id`,
      [request.user.userId, String(crop_name).trim(), variety ? String(variety).trim() : null, expiresOn]
    )
    const created = await fastify.db.query(
      `SELECT ${SELECT_FIELDS} FROM seeds s WHERE s.id = $1`, [res.rows[0].id])
    return reply.code(201).send(withUrls(created.rows[0]))
  })

  // PATCH /seeds/:id — правка культуры/сорта/срока (пакетик перебрали, дату разглядели)
  fastify.patch('/:id', auth, async (request, reply) => {
    const { crop_name, variety } = request.body || {}
    let expiresOn
    if (request.body && 'expires_on' in request.body) {
      expiresOn = normalizeExpiry(request.body.expires_on)
      if (expiresOn === undefined) return reply.code(400).send({ error: 'invalid_expires_on' })
    }
    const res = await fastify.db.query(
      `UPDATE seeds SET
         crop_name  = COALESCE($1::text, crop_name),
         variety    = CASE WHEN $2::boolean THEN $3::varchar ELSE variety END,
         expires_on = CASE WHEN $4::boolean THEN $5::date ELSE expires_on END
       WHERE id = $6 AND user_id = $7
       RETURNING id`,
      [
        crop_name ? String(crop_name).trim() : null,
        variety !== undefined, variety ? String(variety).trim() : null,
        expiresOn !== undefined, expiresOn ?? null,
        request.params.id, request.user.userId
      ]
    )
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' })
    const updated = await fastify.db.query(
      `SELECT ${SELECT_FIELDS} FROM seeds s WHERE s.id = $1`, [res.rows[0].id])
    return withUrls(updated.rows[0])
  })

  // DELETE /seeds/:id — вместе с файлами фото
  fastify.delete('/:id', auth, async (request, reply) => {
    const res = await fastify.db.query(
      'DELETE FROM seeds WHERE id = $1 AND user_id = $2 RETURNING photo_path',
      [request.params.id, request.user.userId]
    )
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' })
    if (res.rows[0].photo_path) await imageService.remove(res.rows[0].photo_path)
    return reply.code(204).send()
  })

  // POST /seeds/:id/photo — multipart, одно фото на пакетик (повторная загрузка заменяет)
  fastify.post('/:id/photo', auth, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'file_required' })

    const userId = request.user.userId
    const found = await fastify.db.query(
      'SELECT photo_path FROM seeds WHERE id = $1 AND user_id = $2', [request.params.id, userId])
    if (!found.rows[0]) {
      try { await data.toBuffer() } catch { /* дренируем поток, иначе запрос повиснет */ }
      return reply.code(404).send({ error: 'not_found' })
    }

    const buffer = await data.toBuffer()
    const meta = await imageService.process(buffer, { dir: `seeds/${userId}` })
    await fastify.db.query('UPDATE seeds SET photo_path = $1 WHERE id = $2', [meta.file_path, request.params.id])
    if (found.rows[0].photo_path) await imageService.remove(found.rows[0].photo_path)

    const row = await fastify.db.query(
      `SELECT ${SELECT_FIELDS} FROM seeds s WHERE s.id = $1`, [request.params.id])
    return reply.code(201).send(withUrls(row.rows[0]))
  })

  // GET /seeds/:id/photo[?thumb=1] — приватная отдача байтов через X-Accel-Redirect
  // (авторизация в Node, сами байты отдаёт nginx — как в /photos/file/:id).
  fastify.get('/:id/photo', auth, async (request, reply) => {
    const found = await fastify.db.query(
      'SELECT photo_path FROM seeds WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!found.rows[0] || !found.rows[0].photo_path) return reply.code(404).send({ error: 'not_found' })
    let rel = found.rows[0].photo_path
    if (request.query.thumb) rel = imageService.thumbPath(rel)
    reply.header('X-Accel-Redirect', `/media-internal/${rel}`)
    reply.header('Content-Type', 'image/webp')
    return reply.send()
  })
}

module.exports.normalizeExpiry = normalizeExpiry
