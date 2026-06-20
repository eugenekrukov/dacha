# F12 Фото-дневник — План 1: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бэкенд фото-дневника — приём/обработка/хранение/выдача фото посадок с лимитами и приватной отдачей.

**Architecture:** Новый роут `routes/photos.js` (паттерны auth/IDOR из `actions.js`) + сервис `services/imageService.js` (sharp: resize→webp 1600px + thumbnail, срез EXIF). Фото — строки `planting_photos` (nullable `action_id`), файлы на диске вне гита, приватная отдача через X-Accel-Redirect. Сервис изображений инъектируется в роут через опции (как `billingOpts`) → в тестах мокается, реальный sharp в тестах не нужен.

**Tech Stack:** Node + Fastify, PostgreSQL (pg), `@fastify/multipart`, `sharp`, vitest + supertest.

**Спецификация:** `docs/superpowers/specs/2026-06-20-photo-diary-design.md`

---

## Структура файлов

- Create: `backend/src/db/migrations/044_planting_photos.sql` — таблица + индексы.
- Create: `backend/src/services/imageService.js` — обработка/запись/удаление файлов (sharp).
- Create: `backend/src/routes/photos.js` — эндпоинты `/photos`.
- Create: `backend/src/__tests__/imageService.test.js` — юнит-тест реального пайплайна.
- Create: `backend/src/__tests__/photos.test.js` — интеграционные тесты роута (мок imageService).
- Modify: `backend/src/app.js` — регистрация `@fastify/multipart` + роута `photos`.
- Modify: `backend/src/__tests__/helpers/buildApp.js` — регистрация `@fastify/multipart` + роута `photos` с инъекцией fake imageService.
- Modify: `backend/package.json` — зависимости `@fastify/multipart`, `sharp`.

---

## Task 1: Зависимости и миграция

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/db/migrations/044_planting_photos.sql`

- [ ] **Step 1: Установить зависимости**

Run (в `backend/`):
```bash
npm install @fastify/multipart sharp
```
Expected: добавлены в `dependencies`, `npm install` без ошибок (sharp скачает prebuilt-бинарь под платформу).

- [ ] **Step 2: Создать миграцию**

Создать `backend/src/db/migrations/044_planting_photos.sql`:
```sql
-- Migration 044: фото-дневник посадок (F12). UGC-фото, привязка к посадке и опц. к действию.
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 044_planting_photos.sql
--   затем: ALTER TABLE planting_photos OWNER TO dacha_user;

CREATE TABLE IF NOT EXISTS planting_photos (
  id           SERIAL PRIMARY KEY,
  planting_id  INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  action_id    INTEGER REFERENCES action_logs(id) ON DELETE SET NULL,
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caption      TEXT,
  visibility   VARCHAR(10) NOT NULL DEFAULT 'private',
  file_path    TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  bytes        INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planting_photos_timeline ON planting_photos(planting_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_planting_photos_action   ON planting_photos(action_id);
```

- [ ] **Step 3: Применить локально и проверить**

Run (в `backend/`, при локальной БД): `npm run migrate`
Expected: `✅ 044_planting_photos.sql`. (Если локальной БД нет — пропустить, миграция применится на проде по плану деплоя Task 8.)

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/db/migrations/044_planting_photos.sql
git commit -m "feat(photos): deps (multipart, sharp) + migration 044 planting_photos"
```

---

## Task 2: imageService (реальный sharp-пайплайн)

**Files:**
- Create: `backend/src/services/imageService.js`
- Test: `backend/src/__tests__/imageService.test.js`

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/__tests__/imageService.test.js`:
```js
'use strict'

const sharp = require('sharp')
const fs = require('fs')
const os = require('os')
const path = require('path')
const imageService = require('../services/imageService')

describe('imageService', () => {
  let dir
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgsvc-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  async function makeJpeg(w, h) {
    return sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 120, b: 30 } } })
      .jpeg().toBuffer()
  }

  it('resize до 1600px, webp, thumbnail, метаданные', async () => {
    const input = await makeJpeg(3000, 2000)
    const res = await imageService.process(input, { plantingId: 7, baseDir: dir })
    // основной файл
    const full = path.join(dir, res.file_path)
    expect(fs.existsSync(full)).toBe(true)
    const meta = await sharp(full).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1600)
    expect(res.width).toBe(meta.width)
    expect(res.height).toBe(meta.height)
    expect(res.bytes).toBeGreaterThan(0)
    // thumbnail
    const thumb = full.replace(/\.webp$/, '_t.webp')
    expect(fs.existsSync(thumb)).toBe(true)
    const tmeta = await sharp(thumb).metadata()
    expect(Math.max(tmeta.width, tmeta.height)).toBeLessThanOrEqual(400)
  })

  it('маленькое фото не увеличивается', async () => {
    const input = await makeJpeg(500, 400)
    const res = await imageService.process(input, { plantingId: 1, baseDir: dir })
    expect(res.width).toBe(500)
    expect(res.height).toBe(400)
  })

  it('remove удаляет основной файл и thumbnail', async () => {
    const input = await makeJpeg(800, 600)
    const res = await imageService.process(input, { plantingId: 2, baseDir: dir })
    await imageService.remove(res.file_path, { baseDir: dir })
    expect(fs.existsSync(path.join(dir, res.file_path))).toBe(false)
    expect(fs.existsSync(path.join(dir, res.file_path.replace(/\.webp$/, '_t.webp')))).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/imageService.test.js`
Expected: FAIL (`imageService.process is not a function` / модуль не найден).

- [ ] **Step 3: Реализовать сервис**

Создать `backend/src/services/imageService.js`:
```js
'use strict'

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEFAULT_BASE = process.env.MEDIA_DIR || '/var/www/dacha-media'
const MAX_EDGE = 1600
const THUMB_EDGE = 400
const QUALITY = 80

function thumbPath(filePath) {
  return filePath.replace(/\.webp$/, '_t.webp')
}

/**
 * Обработать загруженное фото: авто-ориентация, resize 1600px, webp q80, thumbnail 400px,
 * срез всего EXIF (включая GPS). Дату съёмки берём из EXIF DateTimeOriginal до среза.
 * Возвращает { file_path (относительный), width, height, bytes, taken_at|null }.
 */
async function process(buffer, { plantingId, baseDir = DEFAULT_BASE }) {
  const rel = path.posix.join('plantings', String(plantingId), `${crypto.randomUUID()}.webp`)
  const full = path.join(baseDir, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })

  // Дата съёмки из EXIF (sharp отдаёт сырой EXIF-буфер; парсим грубо по строке).
  let takenAt = null
  try {
    const meta = await sharp(buffer).metadata()
    if (meta.exif) {
      const m = meta.exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
      if (m) takenAt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`)
    }
  } catch { /* нет EXIF — не критично */ }

  const out = await sharp(buffer)
    .rotate() // применить EXIF-ориентацию
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY }) // sharp по умолчанию НЕ сохраняет метаданные → EXIF/GPS срезаны
    .toBuffer({ resolveWithObject: true })

  fs.writeFileSync(full, out.data)

  await sharp(buffer)
    .rotate()
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(path.join(baseDir, thumbPath(rel)))

  return {
    file_path: rel,
    width: out.info.width,
    height: out.info.height,
    bytes: out.info.size,
    taken_at: takenAt
  }
}

/** Удалить основной файл и thumbnail (идемпотентно). */
async function remove(relPath, { baseDir = DEFAULT_BASE } = {}) {
  for (const p of [relPath, thumbPath(relPath)]) {
    try { fs.unlinkSync(path.join(baseDir, p)) } catch { /* уже нет — ок */ }
  }
}

module.exports = { process, remove, thumbPath, DEFAULT_BASE }
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/imageService.test.js`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/imageService.js backend/src/__tests__/imageService.test.js
git commit -m "feat(photos): imageService — sharp resize/webp/thumbnail + EXIF strip"
```

---

## Task 3: Роут POST /photos (загрузка + IDOR + квота)

**Files:**
- Create: `backend/src/routes/photos.js`
- Modify: `backend/src/__tests__/helpers/buildApp.js`
- Test: `backend/src/__tests__/photos.test.js`

- [ ] **Step 1: Подключить multipart и роут в buildApp**

В `backend/src/__tests__/helpers/buildApp.js` добавить после строки регистрации `@fastify/jwt` (после строки 20):
```js
  // Приём файлов (фото-дневник). Лимит на размер файла — 10 МБ.
  fastify.register(require('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } })
```
И в блок регистрации роутов (после строки `unsubscribe`) добавить:
```js
  fastify.register(require('../../routes/photos'), { prefix: '/photos', imageService: billingOpts.imageService })
```
(переиспользуем существующий параметр `billingOpts` как контейнер опций тестов; реальные опции billing он не ломает).

- [ ] **Step 2: Написать падающий тест**

Создать `backend/src/__tests__/photos.test.js`:
```js
'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// Fake imageService — реальный sharp в тестах роута не нужен.
function fakeImageService() {
  return {
    processed: [],
    removed: [],
    async process(buf, { plantingId }) {
      const rel = `plantings/${plantingId}/fake-uuid.webp`
      this.processed.push(rel)
      return { file_path: rel, width: 1600, height: 1200, bytes: 12345, taken_at: null }
    },
    async remove(rel) { this.removed.push(rel) }
  }
}

// Мок-БД: настраивается под нужный сценарий через хелперы.
function makeDb({ owns = true, photoCount = 0, accountCount = 0, user = {}, actionMatch = true } = {}) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      if (/FROM plantings p\s+JOIN gardens g/i.test(sql) && /WHERE p\.id/i.test(sql)) {
        return { rows: owns ? [{ '?column?': 1 }] : [] }                       // userOwnsPlanting
      }
      if (/FROM action_logs WHERE id/i.test(sql)) {
        return { rows: actionMatch ? [{ '?column?': 1 }] : [] }                // action принадлежит посадке
      }
      if (/SELECT trial_started_at, subscription_until/i.test(sql)) {
        return { rows: [user] }                                                // строка доступа
      }
      if (/COUNT\(\*\).*FROM planting_photos pp\s+JOIN/i.test(sql)) {
        return { rows: [{ count: String(accountCount) }] }                     // потолок аккаунта
      }
      if (/COUNT\(\*\).*FROM planting_photos WHERE planting_id/i.test(sql)) {
        return { rows: [{ count: String(photoCount) }] }                       // лимит на посадку
      }
      if (/INSERT INTO planting_photos/i.test(sql)) {
        const row = { id: 1, planting_id: params[0], action_id: params[1], file_path: params[2] }
        inserted.push(row)
        return { rows: [row] }
      }
      throw new Error('Неожиданный SQL: ' + sql)
    }
  }
}

describe('POST /photos', () => {
  it('happy path: 201, файл обработан, строка вставлена', async () => {
    const img = fakeImageService()
    const db = makeDb({ photoCount: 0, user: { subscription_until: null, trial_started_at: new Date() } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('fakebytes'), 'photo.jpg')
    expect(res.status).toBe(201)
    expect(img.processed).toHaveLength(1)
    expect(db.inserted).toHaveLength(1)
    await app.close()
  })

  it('IDOR: чужая посадка → 403, файл не обработан', async () => {
    const img = fakeImageService()
    const db = makeDb({ owns: false })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(403)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })

  it('квота free (3-е есть → 4-е) → 409 photo_limit_reached', async () => {
    const img = fakeImageService()
    const db = makeDb({ photoCount: 3, user: { subscription_until: null, trial_started_at: new Date() } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('photo_limit_reached')
    expect(res.body.limit).toBe(3)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })

  it('подписчик: лимит 30 (есть 3 → проходит)', async () => {
    const img = fakeImageService()
    const future = new Date(Date.now() + 30 * 86400000)
    const db = makeDb({ photoCount: 3, user: { subscription_until: future } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(201)
    await app.close()
  })

  it('action_id не от этой посадки → 400', async () => {
    const img = fakeImageService()
    const db = makeDb({ actionMatch: false, user: { trial_started_at: new Date() } })
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .field('action_id', '99')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(400)
    expect(img.processed).toHaveLength(0)
    await app.close()
  })
})
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/photos.test.js`
Expected: FAIL (роут `/photos` не найден → 404).

- [ ] **Step 4: Реализовать роут (POST)**

Создать `backend/src/routes/photos.js`:
```js
'use strict'

const { isSubscribed, hasPromo, isAdSupportedStore } = require('../utils/access')

const PHOTO_LIMIT_FREE = 3
const PHOTO_LIMIT_PAID = 30
const PHOTO_CAP_ACCOUNT = 1000

// «Платный» уровень: подписка / промо / рекламный магазин. Иначе (триал) — бесплатный лимит.
function isPaidTier(user) {
  return !!user && (isSubscribed(user.subscription_until) || hasPromo(user.promo_until) || isAdSupportedStore(user.store))
}

module.exports = async function (fastify, opts) {
  const imageService = opts.imageService || require('../services/imageService')
  const auth = { onRequest: [fastify.authenticate] }

  async function userOwnsPlanting(plantingId, userId) {
    const res = await fastify.db.query(
      `SELECT 1 FROM plantings p
       JOIN gardens g ON g.id = p.garden_id
       WHERE p.id = $1 AND g.user_id = $2`,
      [plantingId, userId]
    )
    return res.rows.length > 0
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
    if (!(await userOwnsPlanting(plantingId, userId))) {
      // Слить тело файла, чтобы не зависнуть на потоке.
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

    // Лимит доступа
    const accessRes = await fastify.db.query(
      'SELECT trial_started_at, subscription_until, promo_until, store FROM users WHERE id = $1', [userId])
    const limit = isPaidTier(accessRes.rows[0]) ? PHOTO_LIMIT_PAID : PHOTO_LIMIT_FREE

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
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/photos.test.js`
Expected: PASS (5 тестов).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js backend/src/__tests__/helpers/buildApp.js
git commit -m "feat(photos): POST /photos — upload, IDOR, action link, quota"
```

---

## Task 4: Роут GET /photos (лента посадки)

**Files:**
- Modify: `backend/src/routes/photos.js`
- Test: `backend/src/__tests__/photos.test.js`

- [ ] **Step 1: Дописать падающий тест**

Добавить в `photos.test.js` новый describe:
```js
describe('GET /photos', () => {
  it('возвращает фото посадки с url/thumb_url, scoped по владельцу', async () => {
    const db = {
      async query(sql, params) {
        if (/SELECT .* FROM planting_photos pp/i.test(sql) && /g\.user_id = \$1/i.test(sql)) {
          expect(params[0]).toBe(1) // userId из токена
          return { rows: [{ id: 10, planting_id: 5, file_path: 'plantings/5/a.webp', taken_at: '2026-06-01', caption: null, action_id: null, width: 1600, height: 1200 }] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, {})
    const res = await supertest(app.server)
      .get('/photos?planting_id=5')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].url).toBe('/photos/file/10')
    expect(res.body[0].thumb_url).toBe('/photos/file/10?thumb=1')
    expect(res.body[0].file_path).toBeUndefined() // внутренний путь наружу не отдаём
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/photos.test.js -t "GET /photos"`
Expected: FAIL (404, роут не реализован).

- [ ] **Step 3: Реализовать GET**

Добавить в `routes/photos.js` внутри `module.exports` (после POST):
```js
  // GET /photos?planting_id= — лента посадки (по владельцу), сорт по дате съёмки.
  fastify.get('/', auth, async (request) => {
    const { planting_id } = request.query
    const params = [request.user.userId]
    const conds = []
    if (planting_id) { params.push(planting_id); conds.push(`pp.planting_id = $${params.length}`) }
    const res = await fastify.db.query(
      `SELECT pp.id, pp.planting_id, pp.action_id, pp.caption, pp.taken_at, pp.width, pp.height
       FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       WHERE g.user_id = $1 ${conds.length ? 'AND ' + conds.join(' AND ') : ''}
       ORDER BY pp.taken_at DESC`,
      params
    )
    return res.rows.map(r => ({ ...r, url: `/photos/file/${r.id}`, thumb_url: `/photos/file/${r.id}?thumb=1` }))
  })
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/photos.test.js`
Expected: PASS (все тесты, включая GET).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js
git commit -m "feat(photos): GET /photos — лента посадки, scoped по владельцу"
```

---

## Task 5: Роут DELETE /photos/:id (удаление + чистка файла)

**Files:**
- Modify: `backend/src/routes/photos.js`
- Test: `backend/src/__tests__/photos.test.js`

- [ ] **Step 1: Дописать падающий тест**

Добавить в `photos.test.js`:
```js
describe('DELETE /photos/:id', () => {
  it('владелец → 204, файл удалён, строка удалена', async () => {
    const img = { removed: [], async remove(rel) { this.removed.push(rel) } }
    const deleted = []
    const db = {
      async query(sql, params) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) {
          return { rows: [{ file_path: 'plantings/5/a.webp' }] } // владелец, фото есть
        }
        if (/DELETE FROM planting_photos WHERE id/i.test(sql)) {
          deleted.push(params[0]); return { rowCount: 1 }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .delete('/photos/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(204)
    expect(img.removed).toEqual(['plantings/5/a.webp'])
    expect(deleted).toEqual([10])
    await app.close()
  })

  it('чужое/несуществующее → 404, файл не трогаем', async () => {
    const img = { removed: [], async remove(rel) { this.removed.push(rel) } }
    const db = {
      async query(sql) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) return { rows: [] }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .delete('/photos/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(404)
    expect(img.removed).toHaveLength(0)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/photos.test.js -t "DELETE"`
Expected: FAIL (404 на самом роуте, обработчика нет).

- [ ] **Step 3: Реализовать DELETE**

Добавить в `routes/photos.js`:
```js
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
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/photos.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js
git commit -m "feat(photos): DELETE /photos/:id — удаление с чисткой файла"
```

---

## Task 6: Приватная отдача GET /photos/file/:id (X-Accel-Redirect)

**Files:**
- Modify: `backend/src/routes/photos.js`
- Test: `backend/src/__tests__/photos.test.js`

- [ ] **Step 1: Дописать падающий тест**

Добавить в `photos.test.js`:
```js
describe('GET /photos/file/:id', () => {
  function db() {
    return {
      async query(sql, params) {
        if (/SELECT pp\.file_path FROM planting_photos pp/i.test(sql)) {
          return params[1] === 1 ? { rows: [{ file_path: 'plantings/5/a.webp' }] } : { rows: [] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  it('владелец → 200 + X-Accel-Redirect на основной файл', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.headers['x-accel-redirect']).toBe('/media-internal/plantings/5/a.webp')
    expect(res.headers['content-type']).toContain('image/webp')
    await app.close()
  })

  it('?thumb=1 → X-Accel-Redirect на thumbnail', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10?thumb=1')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.headers['x-accel-redirect']).toBe('/media-internal/plantings/5/a_t.webp')
    await app.close()
  })

  it('чужое → 404', async () => {
    const app = await buildApp(db(), {})
    const res = await supertest(app.server)
      .get('/photos/file/10')
      .set('Authorization', `Bearer ${makeToken(app, 2)}`)
    expect(res.status).toBe(404)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/photos.test.js -t "file"`
Expected: FAIL.

- [ ] **Step 3: Реализовать отдачу**

Добавить в `routes/photos.js` (использует уже импортированный `imageService` для `thumbPath`):
```js
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
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/photos.test.js`
Expected: PASS (все группы).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js
git commit -m "feat(photos): GET /photos/file/:id — приватная отдача через X-Accel-Redirect"
```

---

## Task 7: Подключение в app.js + джоба-сборщик осиротевших файлов

**Files:**
- Modify: `backend/src/app.js`
- Create: `backend/src/jobs/photoSweepJob.js`
- Test: `backend/src/__tests__/photoSweepJob.test.js`

- [ ] **Step 1: Подключить multipart и роут в app.js**

В `backend/src/app.js`:
1. После регистрации других `@fastify/*` плагинов (рядом с cors/helmet, в начале) добавить:
```js
app.register(require('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } })
```
2. В блок регистрации роутов (после строки `unsubscribe`, ~строка 104) добавить:
```js
app.register(require('./routes/photos'), { prefix: '/photos' })
```
3. В блок джоб (`onReady`, рядом со `startTrialEmailsJob`) добавить импорт и запуск:
```js
const { startPhotoSweepJob } = require('./jobs/photoSweepJob')
// ... внутри onReady:
startPhotoSweepJob(app.db)
```

- [ ] **Step 2: Написать падающий тест джобы**

Создать `backend/src/__tests__/photoSweepJob.test.js`:
```js
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { sweepOrphans } = require('../jobs/photoSweepJob')

describe('photoSweepJob.sweepOrphans', () => {
  it('удаляет файлы, которых нет в БД; известные оставляет', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-'))
    const known = path.join(dir, 'plantings', '5'); fs.mkdirSync(known, { recursive: true })
    fs.writeFileSync(path.join(known, 'keep.webp'), 'x')
    fs.writeFileSync(path.join(known, 'orphan.webp'), 'x')
    const db = { async query() { return { rows: [{ file_path: 'plantings/5/keep.webp' }] } } }

    const removed = await sweepOrphans(db, { baseDir: dir })
    expect(fs.existsSync(path.join(known, 'keep.webp'))).toBe(true)
    expect(fs.existsSync(path.join(known, 'orphan.webp'))).toBe(false)
    expect(removed).toBe(1)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/photoSweepJob.test.js`
Expected: FAIL (модуль/функция нет).

- [ ] **Step 4: Реализовать джобу**

Создать `backend/src/jobs/photoSweepJob.js`:
```js
'use strict'

const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const { DEFAULT_BASE, thumbPath } = require('../services/imageService')

/**
 * Удаляет файлы в каталоге медиа, которым нет соответствия в planting_photos.
 * Thumbnail (_t.webp) считается «известным», если известен его основной файл.
 * Возвращает число удалённых файлов.
 */
async function sweepOrphans(db, { baseDir = DEFAULT_BASE } = {}) {
  const root = path.join(baseDir, 'plantings')
  if (!fs.existsSync(root)) return 0

  const res = await db.query('SELECT file_path FROM planting_photos')
  const known = new Set()
  for (const r of res.rows) { known.add(r.file_path); known.add(thumbPath(r.file_path)) }

  let removed = 0
  for (const plantingDir of fs.readdirSync(root)) {
    const dir = path.join(root, plantingDir)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      const rel = path.posix.join('plantings', plantingDir, f)
      if (!known.has(rel)) { fs.unlinkSync(path.join(dir, f)); removed++ }
    }
  }
  return removed
}

/** Запуск раз в неделю (вс, 04:00). */
function startPhotoSweepJob(db) {
  cron.schedule('0 4 * * 0', () => {
    sweepOrphans(db).then(n => { if (n) console.log(`[photo-sweep] удалено осиротевших файлов: ${n}`) })
      .catch(e => console.error('[photo-sweep] ошибка:', e.message))
  })
}

module.exports = { sweepOrphans, startPhotoSweepJob }
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/photoSweepJob.test.js`
Expected: PASS.

- [ ] **Step 6: Прогнать весь набор тестов**

Run (в `backend/`): `npm test`
Expected: все тесты зелёные (база 312 + новые: imageService 3, photos ~11, sweep 1).

- [ ] **Step 7: Commit**

```bash
git add backend/src/app.js backend/src/jobs/photoSweepJob.js backend/src/__tests__/photoSweepJob.test.js
git commit -m "feat(photos): wire route+multipart в app.js, джоба-сборщик осиротевших файлов"
```

---

## Task 8: Деплой на прод (VPS)

> Не TDD — операционный чеклист. Все ssh — из PowerShell (см. `docs/DEPLOY.md`). SQL — через stdin (двойные кавычки в `psql -c` ломаются).

- [ ] **Step 1: Запушить main и обновить код на VPS**

```powershell
git push origin main
ssh hetzner 'cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main && git rev-parse HEAD'
```

- [ ] **Step 2: Установить зависимости (sharp нативный бинарь!)**

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && npm install'
```
Проверить, что `sharp` поставился под Linux:
```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node -e "require(`sharp`); console.log(`sharp ok`)"'
```
Expected: `sharp ok`. Если бинарь не подхватился — `npm rebuild sharp` или `npm install --os=linux --cpu=x64 sharp`.

- [ ] **Step 3: Применить миграцию 044 + владелец таблицы**

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend/src/db/migrations && sudo -u postgres psql -d dacha_db -f 044_planting_photos.sql'
'ALTER TABLE planting_photos OWNER TO dacha_user;' | ssh hetzner 'sudo -u postgres psql -d dacha_db'
```

- [ ] **Step 4: Создать каталог медиа**

```powershell
ssh hetzner 'mkdir -p /var/www/dacha-media/plantings && chown -R root:www-data /var/www/dacha-media && chmod 750 /var/www/dacha-media'
```
(API-процесс под root пишет; nginx под www-data читает.)

- [ ] **Step 5: nginx — internal-локация + лимит размера тела**

Скриптом через `bash -s` (см. `DEPLOY.md`; первая строка — пустышка против BOM). Добавить в server-блок `/etc/nginx/sites-available/dacha` ДО catch-all `location /`:
```
true
cp /etc/nginx/sites-available/dacha /etc/nginx/sites-available/dacha.bak.photos
```
Затем вручную (или awk-вставкой) добавить:
```nginx
    client_max_body_size 12m;

    location /media-internal/ {
        internal;
        alias /var/www/dacha-media/;
    }
```
Применить:
```powershell
ssh hetzner 'nginx -t && systemctl reload nginx'
```
Expected: `nginx -t` OK.

- [ ] **Step 6: Рестарт бэкенда + health**

```powershell
ssh hetzner 'pm2 restart dacha-api && sleep 1 && curl -s localhost:3002/health'
```
Expected: `{"status":"ok",...}`.

- [ ] **Step 7: Smoke — загрузка и отдача (тест-аккаунтом)**

Загрузить фото за тест-юзера на свою посадку и проверить отдачу:
```powershell
$script = @'
true
cd /var/www/dacha-api/backend
# взять planting_id тест-юзера и сгенерить JWT тем же секретом, что сервер
PID=$(sudo -u postgres psql -d dacha_db -tA -c "SELECT p.id FROM plantings p JOIN gardens g ON g.id=p.garden_id JOIN users u ON u.id=g.user_id WHERE u.is_test=true LIMIT 1")
echo planting=$PID
# (JWT для smoke сгенерировать вручную скриптом с JWT_SECRET из .env; здесь только проверяем доступность роута)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://dacha.studio1008.com/photos
'@
$script | ssh hetzner 'bash -s'
```
Expected: `401` (роут жив, без токена не пускает). Полноценный загрузочный smoke с токеном — по аналогии с проверкой `/unsubscribe` (генерация токена скриптом на сервере с `dotenv`).

- [ ] **Step 8: Записать деплой в session-note**

Добавить блок в `session-note.md` (что задеплоено: миграция 044, sharp, nginx internal+12m, каталог медиа), закоммитить, запушить.

---

## Self-review (выполнено автором плана)
- **Покрытие спека:** §2 модель → Task 1; §3 хранение + §5 пайплайн → Task 2; §4 POST/GET/DELETE/file → Tasks 3–6; чистка/джоба → Tasks 5,7; §7 деплой → Task 8; §8 тесты → во всех backend-задачах. Клиенты (§6) — отдельные планы (веб, Android), составляются после бэкенда.
- **Плейсхолдеров нет:** весь код приведён целиком.
- **Согласованность типов:** `imageService.process(buffer,{plantingId,baseDir})` → `{file_path,width,height,bytes,taken_at}`; `imageService.remove(rel)`, `imageService.thumbPath(rel)`, `imageService.DEFAULT_BASE` — используются единообразно в Tasks 2,3,5,6,7. Имена колонок совпадают с миграцией Task 1.
