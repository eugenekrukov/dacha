# Telegram-автопостер Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бот `@calendacha_bot` автоматически постит контент из очереди `vk_post_queue` в Telegram-канал `@calendacha`, независимо от публикации в ВК.

**Architecture:** Аддитивная миграция добавляет `telegram_*` колонки к существующей `vk_post_queue`. Новый `telegramService.js` (тонкая обёртка над Bot API) + новый `telegramQueueJob.js` (cron по образцу `vkQueueJob.js`), включается только при заданных `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHANNEL_ID`.

**Tech Stack:** Node.js (fastify backend), встроенный `fetch`, `node-cron`, vitest.

Дизайн: [docs/superpowers/specs/2026-07-18-telegram-autopost-design.md](../specs/2026-07-18-telegram-autopost-design.md)

---

### Task 1: Миграция — telegram-колонки в `vk_post_queue`

**Files:**
- Create: `backend/src/db/migrations/058_telegram_queue_columns.sql`

- [ ] **Step 1: Написать миграцию**

```sql
-- Migration 058: колонки для независимой Telegram-публикации той же очереди контента.
-- Автопостер: cron-джоб jobs/telegramQueueJob.js публикует «созревшие» посты из vk_post_queue
-- (та же очередь, что и для ВК) в Telegram-канал через Bot API. Статус независим от `status` (ВК),
-- чтобы сбой в одном канале не блокировал и не дублировал публикацию в другом (ни wall.post,
-- ни sendMessage не идемпотентны).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 058_telegram_queue_columns.sql

ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_post_url TEXT;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_error TEXT;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_posted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vk_queue_telegram_due ON vk_post_queue(scheduled_at)
  WHERE telegram_status = 'pending';
```

- [ ] **Step 2: Применить локально (dev БД) через штатный раннер**

Run: `cd backend && npm run migrate`

(`backend/src/db/migrate.js` прогоняет все `.sql` из `migrations/` по порядку; наша миграция
идемпотентна за счёт `IF NOT EXISTS`, повторный прогон остальных файлов безопасен.)

Expected: `✅ 058_telegram_queue_columns.sql` в выводе, без ошибок. Проверить: `\d vk_post_queue`
в psql показывает новые колонки.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/058_telegram_queue_columns.sql
git commit -m "db: telegram-колонки в vk_post_queue для независимого автопостера"
```

---

### Task 2: `telegramService.js` — обёртка над Bot API

**Files:**
- Create: `backend/src/services/telegramService.js`
- Test: `backend/src/__tests__/telegramService.test.js`

- [ ] **Step 1: Написать падающий тест**

```javascript
'use strict'

const { sendPost, postUrl } = require('../services/telegramService')

describe('telegramService', () => {
  it('sendPost без фото → sendMessage с text', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', text: 'привет' }, fetchImpl)
    expect(r).toEqual({ messageId: 42 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendMessage')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', text: 'привет' })
  })

  it('sendPost с photoUrl → sendPhoto с caption', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', text: 'подпись', photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 43 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendPhoto')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', photo: 'https://img/x.jpg', caption: 'подпись' })
  })

  it('sendPost пробрасывает ошибку Bot API', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: false, error_code: 403, description: 'bot is not a member' }) })
    await expect(sendPost({ token: 'tok', channelId: '@calendacha', text: 'x' }, fetchImpl))
      .rejects.toThrow('Telegram sendMessage: 403 bot is not a member')
  })

  it('postUrl строит ссылку на пост в публичном канале', () => {
    expect(postUrl('@calendacha', 42)).toBe('https://t.me/calendacha/42')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/telegramService.test.js`
Expected: FAIL — `Cannot find module '../services/telegramService'`

- [ ] **Step 3: Реализовать `telegramService.js`**

```javascript
'use strict'

// Постинг в Telegram-канал через Bot API: sendMessage (без фото) или sendPhoto (с caption).
// В отличие от ВК, ссылка в теле поста не режет охват в Telegram — текст и ссылка идут одним
// сообщением, без трюка «ссылка первым комментарием».
//
// Требует Node 18+/20+ (глобальный fetch) — внешних зависимостей нет.

const API = 'https://api.telegram.org/bot'

async function sendPost({ token, channelId, text, photoUrl }, fetchImpl = fetch) {
  const method = photoUrl ? 'sendPhoto' : 'sendMessage'
  const body = photoUrl
    ? { chat_id: channelId, photo: photoUrl, caption: text }
    : { chat_id: channelId, text }
  const res = await fetchImpl(`${API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram ${method}: ${json.error_code} ${json.description}`)
  }
  return { messageId: json.result.message_id }
}

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
```

- [ ] **Step 4: Тест проходит**

Run: `cd backend && npx vitest run src/__tests__/telegramService.test.js`
Expected: PASS (4 теста)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/telegramService.js backend/src/__tests__/telegramService.test.js
git commit -m "feat: telegramService — постинг в канал через Bot API"
```

---

### Task 3: `telegramQueueJob.js` — cron-автопостер

**Files:**
- Create: `backend/src/jobs/telegramQueueJob.js`
- Test: `backend/src/__tests__/telegramQueue.test.js`

- [ ] **Step 1: Написать падающий тест**

```javascript
'use strict'

const { queueMessage } = require('../services/vkContent')
const { runTelegramQueue, isEnabled } = require('../jobs/telegramQueueJob')

const ENV = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '@calendacha' }

function fakeDb(dueRows = []) {
  const updates = []
  return {
    updates,
    query: async (sql, args) => {
      if (/SELECT[\s\S]*FROM vk_post_queue/i.test(sql)) return { rows: dueRows }
      if (/^\s*UPDATE vk_post_queue/i.test(sql)) { updates.push({ sql, args }); return { rows: [] } }
      return { rows: [] }
    }
  }
}

function fakeTgSvc(messageId = 42) {
  const calls = { sendPost: [] }
  return {
    calls,
    sendPost: async (args) => { calls.sendPost.push(args); return { messageId } },
    postUrl: (chan, id) => `https://t.me/${chan.replace(/^@/, '')}/${id}`
  }
}

describe('telegramQueueJob', () => {
  it('isEnabled требует токен и канал', () => {
    expect(isEnabled({})).toBe(false)
    expect(isEnabled(ENV)).toBe(true)
  })

  it('публикует созревший пост (фото + теги) и помечает telegram_status=posted', async () => {
    const db = fakeDb([{ id: 1, body: 'текст', tags: '#дача', image_url: 'https://img/x.jpg', link: 'https://dacha.studio1008.com', telegram_attempts: 0 }])
    const tg = fakeTgSvc(42)
    const r = await runTelegramQueue(db, { tg, env: ENV })
    expect(r.posted).toBe(1)
    const call = tg.calls.sendPost[0]
    expect(call.text).toBe(queueMessage({ body: 'текст', tags: '#дача' }) + '\n\nhttps://dacha.studio1008.com')
    expect(call.photoUrl).toBe('https://img/x.jpg')
    const upd = db.updates.find((u) => /telegram_status='posted'/.test(u.sql))
    expect(upd.args).toEqual(['https://t.me/calendacha/42', 1])
  })

  it('нет созревших — ничего не постит', async () => {
    const tg = fakeTgSvc()
    const r = await runTelegramQueue(fakeDb([]), { tg, env: ENV })
    expect(r.posted).toBe(0)
    expect(tg.calls.sendPost).toHaveLength(0)
  })

  it('ошибка постинга на 3-й попытке → telegram_status=failed', async () => {
    const db = fakeDb([{ id: 2, body: 'x', tags: null, image_url: null, telegram_attempts: 2 }])
    const tg = fakeTgSvc()
    tg.sendPost = async () => { throw new Error('boom') }
    const r = await runTelegramQueue(db, { tg, env: ENV })
    expect(r.failed).toBe(1)
    expect(db.updates[0].args[0]).toBe(3)        // telegram_attempts
    expect(db.updates[0].args[2]).toBe('failed') // telegram_status
  })

  it('без env — no-op', async () => {
    const tg = fakeTgSvc()
    const r = await runTelegramQueue(fakeDb([{ id: 1, body: 'x' }]), { tg, env: {} })
    expect(r.posted).toBe(0)
    expect(tg.calls.sendPost).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/telegramQueue.test.js`
Expected: FAIL — `Cannot find module '../jobs/telegramQueueJob'`

- [ ] **Step 3: Реализовать `telegramQueueJob.js`**

```javascript
'use strict'

// Агент-автопостер Telegram: фоновый джоб публикует «созревшие» посты из той же очереди, что
// наполняется для ВК (vk_post_queue, backend/scripts/vk-queue.js load <file>), в Telegram-канал.
// Статус независим от `status` (ВК) — колонки telegram_* (миграция 058). Движок постинга —
// services/telegramService.js. Включается заданием TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID.

const cron = require('node-cron')
const telegramService = require('../services/telegramService')
const { queueMessage } = require('../services/vkContent')

const MAX_ATTEMPTS = 3
const BATCH = 2 // постов за прогон — мягко к лимитам Bot API

const defaultLink = (env) => env.TELEGRAM_POST_LINK || 'https://dacha.studio1008.com'

function isEnabled(env = process.env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID)
}

// deps инъектируются в тестах.
async function runTelegramQueue(db, { tg: tgSvc = telegramService, env = process.env } = {}) {
  if (!isEnabled(env)) {
    console.log('[telegram-queue] отключён (нет TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)')
    return { posted: 0, failed: 0 }
  }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHANNEL_ID: channelId } = env

  // Тот же расчёт на один инстанс pm2, что и у vkQueueJob (см. его комментарий) — строки не
  // клеймятся FOR UPDATE SKIP LOCKED, sendMessage/sendPhoto не идемпотентны.
  const due = await db.query(
    `SELECT id, body, tags, image_url, link, telegram_attempts
       FROM vk_post_queue
      WHERE telegram_status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at
      LIMIT ${BATCH}`
  )
  if (due.rows.length === 0) return { posted: 0, failed: 0 }

  let posted = 0
  let failed = 0
  for (const row of due.rows) {
    try {
      const link = row.link || defaultLink(env)
      const text = `${queueMessage({ body: row.body, tags: row.tags })}\n\n${link}`
      const { messageId } = await tgSvc.sendPost({ token, channelId, text, photoUrl: row.image_url || undefined })
      const url = tgSvc.postUrl(channelId, messageId)
      await db.query(
        "UPDATE vk_post_queue SET telegram_status='posted', telegram_post_url=$1, telegram_posted_at=NOW(), telegram_error=NULL WHERE id=$2",
        [url, row.id]
      )
      posted++
      console.log(`[telegram-queue] опубликовано #${row.id}: ${url}`)
    } catch (e) {
      const attempts = (row.telegram_attempts || 0) + 1
      const isFailed = attempts >= MAX_ATTEMPTS
      await db.query(
        'UPDATE vk_post_queue SET telegram_attempts=$1, telegram_error=$2, telegram_status=$3 WHERE id=$4',
        [attempts, e.message, isFailed ? 'failed' : 'pending', row.id]
      )
      if (isFailed) failed++
      console.error(`[telegram-queue] #${row.id} ${isFailed ? 'failed' : 'retry'} (попытка ${attempts}): ${e.message}`)
    }
  }
  return { posted, failed }
}

function startTelegramQueueJob(db) {
  if (!isEnabled()) { console.log('[telegram-queue] автопостер Telegram отключён (нет env)'); return }
  cron.schedule('*/10 * * * *', () => {
    runTelegramQueue(db).catch((e) => console.error('[telegram-queue]', e.message))
  })
  console.log('[telegram-queue] автопостер Telegram запущен: проверка очереди каждые 10 минут')
}

module.exports = { startTelegramQueueJob, runTelegramQueue, isEnabled }
```

- [ ] **Step 4: Тест проходит**

Run: `cd backend && npx vitest run src/__tests__/telegramQueue.test.js`
Expected: PASS (5 тестов)

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs/telegramQueueJob.js backend/src/__tests__/telegramQueue.test.js
git commit -m "feat: telegramQueueJob — cron-автопостер в Telegram-канал"
```

---

### Task 4: Wiring в `app.js`

**Files:**
- Modify: `backend/src/app.js:130` (после `startVkQueueJob` require), `backend/src/app.js:139` (после вызова)

- [ ] **Step 1: Добавить require и запуск джоба**

В `backend/src/app.js`, строка 130, после:
```javascript
const { startVkQueueJob } = require('./jobs/vkQueueJob')
```
добавить:
```javascript
const { startTelegramQueueJob } = require('./jobs/telegramQueueJob')
```

Строка 139 (внутри `app.addHook('onReady', ...)`), после:
```javascript
  startVkQueueJob(app.db)
```
добавить:
```javascript
  startTelegramQueueJob(app.db)
```

- [ ] **Step 2: Прогнать весь бэкенд-тест-сьют**

Run: `cd backend && npm test`
Expected: PASS, без регрессий в остальных тестах.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.js
git commit -m "feat: включить telegramQueueJob в старт приложения"
```

---

### Task 5: Документация — `docs/DEPLOY.md`

**Files:**
- Modify: `docs/DEPLOY.md` (после раздела «Автопостер ВК (маркетинг, `vk-queue`)», см. `docs/DEPLOY.md:149-183`)

- [ ] **Step 1: Добавить раздел по образцу секции ВК**

Вставить после существующего блока «Автопостер ВК» (перед `---` перед «## История»):

```markdown
## Автопостер Telegram (маркетинг, тот же `vk-queue`)

Агент-автопостер: cron-джоб `jobs/telegramQueueJob.js` (`*/10`) публикует «созревшие» посты из
той же таблицы `vk_post_queue` (миграция **058**, колонки `telegram_*`) в Telegram-канал через
Bot API. Очередь наполняется тем же CLI, что и для ВК (`scripts/vk-queue.js load <файл>`) —
отдельного скрипта загрузки не нужно. Без env (`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHANNEL_ID`) джоб
idle — деплоить безопасно.

**Деплой:** обычный backend (`reset --hard` + `pm2 restart`); миграция один раз:
`sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/058_telegram_queue_columns.sql`
(как и остальные миграции на VPS — `dacha_user` не имеет прав DDL).

**`.env` (Hetzner):**
```
TELEGRAM_BOT_TOKEN=8333482648:AAFY...        # токен от BotFather, бот @calendacha_bot
TELEGRAM_CHANNEL_ID=@calendacha              # публичный канал → username вместо числового chat_id
TELEGRAM_POST_LINK=https://dacha.studio1008.com   # опц., деф. = лендинг
```
Канал должен быть публичным (с `@username`) — тогда `chat_id` для Bot API это сам username, не
нужно вычислять числовой id через `getUpdates`. Бот должен быть добавлен в канал администратором
с правом «Публикация сообщений» — без этого `sendMessage`/`sendPhoto` вернёт 403.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: автопостер Telegram — деплой и env"
```

---

### Task 6: Деплой на VPS (требует явного подтверждения перед выполнением)

**Что делает:** пушит ветку, подтягивает код на сервере, применяет миграцию, добавляет `.env`, перезапускает pm2.

- [ ] **Step 1: Спросить пользователя явное разрешение на `git push origin main`** (см. [[feedback-code-style]] — пуш в main не покрывается общим «делай сам», нужен явный запрос в моменте)

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: На сервере — подтянуть код и применить миграцию**

Per `CLAUDE.md`: DDL на VPS — только от суперюзера `postgres` (`dacha_user` не имеет прав на
`ALTER TABLE`/`CREATE INDEX`, `npm run migrate` под ним на сервере не сработает):

```powershell
ssh hetzner 'cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main'
ssh hetzner 'sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/058_telegram_queue_columns.sql'
```
Expected: `ALTER TABLE` x5 + `CREATE INDEX` без ошибок.

- [ ] **Step 4: Добавить переменные в `.env` на сервере**

```powershell
ssh hetzner "cat >> /var/www/dacha-api/backend/.env << 'EOF'

TELEGRAM_BOT_TOKEN=8333482648:AAFYwIxMCtmy7di_pibh92tvlfklMeBKleA
TELEGRAM_CHANNEL_ID=@calendacha
EOF"
```

- [ ] **Step 5: Перезапустить backend**

```powershell
ssh hetzner 'pm2 restart dacha-api'
```

- [ ] **Step 6: Проверить лог — джоб стартовал**

```powershell
ssh hetzner 'pm2 logs dacha-api --lines 30 --nostream | grep telegram-queue'
```
Expected: `[telegram-queue] автопостер Telegram запущен: проверка очереди каждые 10 минут`

- [ ] **Step 7: Дождаться следующего «созревшего» поста в очереди ВК (или добавить тестовый через `INSERT ... scheduled_at=NOW()`) и проверить, что пост появился в @calendacha, а `telegram_post_url` заполнился**

```powershell
ssh hetzner "sudo -u postgres psql -d dacha_db -c \"SELECT id, status, telegram_status, telegram_post_url FROM vk_post_queue ORDER BY id DESC LIMIT 5;\""
```
