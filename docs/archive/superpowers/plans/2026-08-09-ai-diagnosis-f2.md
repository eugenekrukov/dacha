# AI-диагностика по фото (F2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать «Дачник Про»-пользователям кнопку «Определить болезнь/вредителя» на фото в дневнике посадки — closed-set AI-диагноз (топ-2/3 кандидата + обоснование) через Qwen-VL, с явным дисклеймером «предварительно».

**Architecture:** Тонкий сервис `aiDiagnosisService` (мирроит паттерн `nalogService`/`OpenAICompatibleClient` из Tender AI) шлёт фото + список кандидатов болезней/вредителей ИЗ СВОЕГО ЖЕ `guide_entries`/`crop_guide_entries` (closed-set, не открытый вопрос — прототип показал 20%→80-94% разницу в точности) в Qwen-VL, парсит JSON-ответ, кладёт в новую колонку `planting_photos.ai_diagnosis`. Один новый эндпоинт `POST /photos/:id/diagnose`, под платным гейтом (`hasAccess`). Веб и Android — тонкие клиенты поверх готового API.

**Tech Stack:** Node/Fastify (backend), Qwen-VL `qwen-vl-plus` через DashScope international OpenAI-совместимый endpoint, React/TS (web), Kotlin/Compose (Android).

**Обоснование решений (см. память `project_dacha_ai_diagnosis.md`):** closed-set промпт по `crop_id`, ответ — топ-2/3 кандидата с обоснованием (не единственный вердикт), подача в UI как «похоже на X, возможно Y» + дисклеймер.

---

## Предварительное условие (делает пользователь, не агент)

Нужен рабочий ключ Qwen (DashScope international, Singapore). Прототип уже использовал ключ вида `sk-ws-...` — если он ещё жив, переиспользовать; если протух/отозван — завести новый (описано в предыдущей сессии), положить в `.env` на VPS как `AI_DIAGNOSIS_API_KEY`. Без ключа `isEnabled()` вернёт `false` и эндпоинт будет отвечать 503 — это ожидаемо для локальной разработки без ключа.

---

## Phase 1 — Backend

### Task 1: Миграция `ai_diagnosis` на `planting_photos`

**Files:**
- Create: `backend/src/db/migrations/066_photo_ai_diagnosis.sql`

- [ ] **Шаг 1: Написать миграцию**

```sql
-- 066_photo_ai_diagnosis.sql
-- F2: AI-диагностика по фото (closed-set, Qwen-VL). Результат кладём прямо на фото —
-- один диагноз на фото, отдельная таблица не нужна (YAGNI, пока нет истории пере-диагнозов).
-- Идемпотентно: IF NOT EXISTS.

ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosis JSONB;
ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosed_at TIMESTAMPTZ;
```

- [ ] **Шаг 2: Прогнать миграции локально**

Run: `cd backend && npm run migrate` (или команда из `scripts/`, см. `db/migrate.js` — тот же способ, каким гоняются существующие миграции)
Expected: `066_photo_ai_diagnosis.sql` применилась без ошибок, повторный прогон — no-op.

- [ ] **Шаг 3: Commit**

```bash
git add backend/src/db/migrations/066_photo_ai_diagnosis.sql
git commit -m "feat(db): миграция ai_diagnosis на planting_photos (F2)"
```

---

### Task 2: `services/aiDiagnosisService.js`

**Files:**
- Create: `backend/src/services/aiDiagnosisService.js`
- Test: `backend/src/__tests__/aiDiagnosisService.test.js`

Мирроит `nalogService.js` (env-var `isEnabled()`, `node-fetch`) и промпт-контракт из Tender `openai_compatible_client.py` (JSON-ответ, `response_format: json_object`, один ретрай при невалидном JSON), но под vision (`image_url` в content) и без цепочки бесплатных моделей — YAGNI, у Dacha мало клиентов, цепочка фолбэков понадобится только если реально упрёмся в квоту.

- [ ] **Шаг 1: Написать падающий тест**

```js
'use strict'

const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest')

describe('aiDiagnosisService', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV, AI_DIAGNOSIS_API_KEY: 'test-key' }
  })
  afterEach(() => { process.env = OLD_ENV })

  it('isEnabled() true только с ключом', () => {
    const svc = require('../services/aiDiagnosisService')
    expect(svc.isEnabled()).toBe(true)
    process.env.AI_DIAGNOSIS_API_KEY = ''
    expect(svc.isEnabled()).toBe(false)
  })

  it('diagnose(): шлёт closed-set промпт, парсит топ-кандидаты из JSON-ответа', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              candidates: [
                { id: 8, name: 'Фитофтороз', confidence: 'high', reasoning: 'Бурые пятна на плодах' },
                { id: 61, name: 'Вершинная гниль', confidence: 'medium', reasoning: 'Похожее потемнение' }
              ]
            })
          }
        }],
        usage: { prompt_tokens: 800, completion_tokens: 120 }
      })
    })

    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('fake-image-bytes'),
      cropName: 'Томат',
      candidates: [
        { id: 8, name: 'Фитофтороз', kind: 'disease' },
        { id: 61, name: 'Вершинная гниль', kind: 'disease' }
      ],
      fetchImpl: fakeFetch
    })

    expect(fakeFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = fakeFetch.mock.calls[0]
    expect(url).toContain('/chat/completions')
    const body = JSON.parse(opts.body)
    expect(body.model).toBe('qwen-vl-plus')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1].content[1].text).toContain('Томат')
    expect(body.messages[1].content[1].text).toContain('Фитофтороз')

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0].id).toBe(8)
    expect(result.model).toBe('qwen-vl-plus')
  })

  it('diagnose(): невалидный JSON в ответе → один ретрай, затем null-кандидаты', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'не JSON, простите' } }], usage: {} })
    })
    const svc = require('../services/aiDiagnosisService')
    const result = await svc.diagnose({
      imageBuffer: Buffer.from('x'),
      cropName: 'Огурец',
      candidates: [{ id: 1, name: 'Тест', kind: 'disease' }],
      fetchImpl: fakeFetch
    })
    expect(fakeFetch).toHaveBeenCalledTimes(2) // ретрай
    expect(result.candidates).toEqual([])
  })
})
```

- [ ] **Шаг 2: Убедиться, что тест падает (модуля ещё нет)**

Run: `cd backend && npx vitest run src/__tests__/aiDiagnosisService.test.js`
Expected: FAIL — `Cannot find module '../services/aiDiagnosisService'`

- [ ] **Шаг 3: Написать сервис**

```js
'use strict'

const fetch = require('node-fetch')

// AI-диагностика по фото (F2, closed-set): фото + список кандидатов ИЗ СВОЕГО guide_entries
// (не открытый вопрос) → Qwen-VL выбирает топ-N по обоснованию. Прототип (2026-08-09):
// open-set 20% точности, closed-set 65-94% в зависимости от типа поражения (память
// project_dacha_ai_diagnosis.md). Включается AI_DIAGNOSIS_API_KEY (паттерн nalogService/isEnabled).
//
// ponytail: без цепочки бесплатных моделей (в отличие от Tender openai_compatible_client.py) —
// у Dacha мало клиентов, усложнять фолбэками пока незачем. Добавить, если реально упрёмся в квоту.

const BASE_URL = () => process.env.AI_DIAGNOSIS_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const MODEL = () => process.env.AI_DIAGNOSIS_MODEL || 'qwen-vl-plus'
const TIMEOUT_MS = 30000

function isEnabled() {
  return !!process.env.AI_DIAGNOSIS_API_KEY
}

const SYSTEM = (
  'Ты агроном-эксперт. Тебе дано фото и ЗАКРЫТЫЙ список возможных болезней/вредителей ' +
  'этой культуры. Выбери 2-3 наиболее вероятных варианта СТРОГО из списка (по id), ' +
  'от самого вероятного к менее вероятному. Если ни один не подходит — верни пустой массив. ' +
  'Ответ СТРОГО валидным JSON без markdown: {"candidates": [{"id": <int>, "name": "<строго из списка>", ' +
  '"confidence": "high|medium|low", "reasoning": "краткое обоснование по видимым признакам"}]}'
)

function buildPayload(system, userText, dataUrl) {
  return {
    model: MODEL(),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: userText }
      ] }
    ],
    max_tokens: 500,
    temperature: 0,
    response_format: { type: 'json_object' }
  }
}

async function callOnce(payload, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${BASE_URL()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_DIAGNOSIS_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`AI diagnosis HTTP ${res.status}`)
    const data = await res.json()
    const text = ((data.choices || [])[0] || {}).message?.content || ''
    return { text, usage: data.usage || {} }
  } finally {
    clearTimeout(timer)
  }
}

function parseCandidates(text, validIds) {
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed.candidates) ? parsed.candidates : []
    // Не доверяем модели вслепую: оставляем только id из переданного closed-set списка.
    return list.filter((c) => validIds.has(c.id)).slice(0, 3)
  } catch {
    return null
  }
}

/**
 * @param {Buffer} imageBuffer - байты фото (уже обработанное webp, 1600px)
 * @param {string} cropName - культура посадки, для контекста промпта
 * @param {{id:number,name:string,kind:string}[]} candidates - closed-set список из guide_entries
 * @param {Function} [fetchImpl] - для тестов; по умолчанию node-fetch
 * @returns {Promise<{candidates: Array, model: string}>}
 */
async function diagnose({ imageBuffer, cropName, candidates, fetchImpl = fetch }) {
  const validIds = new Set(candidates.map((c) => c.id))
  const candText = candidates.map((c) => `- id=${c.id}, ${c.kind}: ${c.name}`).join('\n')
  const userText = `Культура: ${cropName}.\nВозможные варианты:\n${candText}\n\nЧто на фото?`
  const dataUrl = `data:image/webp;base64,${imageBuffer.toString('base64')}`

  let { text } = await callOnce(buildPayload(SYSTEM, userText, dataUrl), fetchImpl)
  let parsed = parseCandidates(text, validIds)

  if (parsed === null) {
    // Один ретрай с более настойчивой инструкцией — как в Tender openai_compatible_client.
    ;({ text } = await callOnce(
      buildPayload(SYSTEM, userText + '\n\nВерни ТОЛЬКО JSON-объект, ничего больше.', dataUrl),
      fetchImpl
    ))
    parsed = parseCandidates(text, validIds) || []
  }

  return { candidates: parsed, model: MODEL() }
}

module.exports = { isEnabled, diagnose }
```

- [ ] **Шаг 4: Прогнать тест — PASS**

Run: `cd backend && npx vitest run src/__tests__/aiDiagnosisService.test.js`
Expected: PASS (3 теста)

- [ ] **Шаг 5: Commit**

```bash
git add backend/src/services/aiDiagnosisService.js backend/src/__tests__/aiDiagnosisService.test.js
git commit -m "feat(ai-diagnosis): сервис Qwen-VL closed-set диагностики (F2)"
```

---

### Task 3: Эндпоинт `POST /photos/:id/diagnose`

**Files:**
- Modify: `backend/src/routes/photos.js`
- Modify: `backend/src/__tests__/photos.test.js`

- [ ] **Шаг 1: Написать падающий тест**

Добавить в `backend/src/__tests__/photos.test.js` (после существующих секций, тот же файл — маршрут диагностики логически часть `/photos`):

```js
describe('POST /photos/:id/diagnose', () => {
  function makeDiagDb({ owns = true, subscribed = true, cropId = 3, cropName = 'Томат',
                        filePath = 'plantings/5/uuid.webp', freeIds = [] } = {}) {
    return {
      async query(sql, params) {
        const ft = freeTierQuery(sql, { subscribed, freeIds })
        if (ft) return ft
        if (/SELECT pp\.file_path, pp\.planting_id, p\.crop_id, c\.name AS crop_name/i.test(sql)) {
          return { rows: owns ? [{ file_path: filePath, planting_id: 5, crop_id: cropId, crop_name: cropName }] : [] }
        }
        if (/FROM guide_entries e\s+JOIN crop_guide_entries/i.test(sql)) {
          return { rows: [
            { id: 8, name: 'Фитофтороз', kind: 'disease' },
            { id: 61, name: 'Вершинная гниль', kind: 'disease' }
          ] }
        }
        if (/UPDATE planting_photos SET ai_diagnosis/i.test(sql)) {
          return { rows: [{ id: params[2], ai_diagnosis: JSON.parse(params[0]), ai_diagnosed_at: params[1] }] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  function fakeAiService(overrides = {}) {
    return {
      isEnabled: () => true,
      diagnose: async () => ({
        candidates: [{ id: 8, name: 'Фитофтороз', confidence: 'high', reasoning: 'тест' }],
        model: 'qwen-vl-plus'
      }),
      ...overrides
    }
  }

  function fakeFs() {
    return { readFile: async () => Buffer.from('fake-webp-bytes') }
  }

  it('happy path: 200, диагноз записан', async () => {
    const db = makeDiagDb()
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService(), fsPromises: fakeFs() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(200)
    expect(res.body.candidates).toHaveLength(1)
    expect(res.body.disclaimer).toMatch(/предварительн/i)
    await app.close()
  })

  it('без подписки → 402 subscription_required', async () => {
    const db = makeDiagDb({ subscribed: false })
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(402)
    await app.close()
  })

  it('чужое фото → 404', async () => {
    const db = makeDiagDb({ owns: false })
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService() })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(404)
    await app.close()
  })

  it('сервис выключен (нет ключа) → 503', async () => {
    const db = makeDiagDb()
    const app = await buildApp(db, { aiDiagnosisService: fakeAiService({ isEnabled: () => false }) })
    const res = await supertest(app.server)
      .post('/photos/1/diagnose')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
    expect(res.status).toBe(503)
    await app.close()
  })
})
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/photos.test.js -t "diagnose"`
Expected: FAIL — 404 (роута ещё нет) вместо ожидаемых кодов

- [ ] **Шаг 3: Дописать роут в `backend/src/routes/photos.js`**

Добавить наверх файла (рядом с существующим `require`):

```js
const fsPromises = require('fs/promises')
const path = require('path')
```

Добавить в сигнатуру `module.exports`, рядом с `imageService`:

```js
module.exports = async function (fastify, opts) {
  const imageService = opts.imageService || require('../services/imageService')
  const aiDiagnosisService = opts.aiDiagnosisService || require('../services/aiDiagnosisService')
  const fsImpl = opts.fsPromises || fsPromises
  const { hasAccess } = require('../utils/access')
  const auth = { onRequest: [fastify.authenticate] }
  // ... (существующий код getOwnedPlanting и роутов остаётся как есть)
```

Добавить новый роут перед закрывающей скобкой модуля (после `GET /file/:id`):

```js
  // POST /photos/:id/diagnose — AI-диагноз (closed-set по culture, F2, «Дачник Про»).
  fastify.post('/:id/diagnose', auth, async (request, reply) => {
    if (!aiDiagnosisService.isEnabled()) {
      return reply.code(503).send({ error: 'ai_diagnosis_unavailable' })
    }

    const userId = request.user.userId
    const userRes = await fastify.db.query(
      'SELECT subscription_until, promo_until, store FROM users WHERE id = $1', [userId]
    )
    if (!hasAccess(userRes.rows[0] || {})) {
      return reply.code(402).send({ error: 'subscription_required' })
    }

    const id = parseInt(request.params.id, 10)
    const found = await fastify.db.query(
      `SELECT pp.file_path, pp.planting_id, p.crop_id, c.name AS crop_name
       FROM planting_photos pp
       JOIN plantings p ON p.id = pp.planting_id
       JOIN gardens g   ON g.id = p.garden_id
       JOIN crops c     ON c.id = p.crop_id
       WHERE pp.id = $1 AND g.user_id = $2`,
      [id, userId]
    )
    const photo = found.rows[0]
    if (!photo) return reply.code(404).send({ error: 'not_found' })

    // Closed-set кандидаты: болезни/вредители ИМЕННО этой культуры (тот же JOIN, что в guide.js).
    const guideRes = await fastify.db.query(
      `SELECT e.id, e.name, e.kind
       FROM guide_entries e
       JOIN crop_guide_entries cg ON cg.entry_id = e.id AND cg.crop_id = $1
       WHERE e.kind IN ('disease', 'pest')`,
      [photo.crop_id]
    )
    if (guideRes.rows.length === 0) {
      return reply.code(422).send({ error: 'no_guide_entries_for_crop' })
    }

    const mediaDir = process.env.MEDIA_DIR || '/var/www/dacha-media'
    const imageBuffer = await fsImpl.readFile(path.join(mediaDir, photo.file_path))

    const result = await aiDiagnosisService.diagnose({
      imageBuffer,
      cropName: photo.crop_name,
      candidates: guideRes.rows
    })

    const diagnosedAt = new Date()
    await fastify.db.query(
      'UPDATE planting_photos SET ai_diagnosis = $1, ai_diagnosed_at = $2 WHERE id = $3',
      [JSON.stringify(result.candidates), diagnosedAt, id]
    )

    return reply.code(200).send({
      candidates: result.candidates,
      disclaimer: 'Предварительная оценка ИИ — не заменяет консультацию агронома. Сверьтесь со справочником.',
      diagnosed_at: diagnosedAt
    })
  })
```

- [ ] **Шаг 4: Прогнать тесты — PASS**

Run: `cd backend && npx vitest run src/__tests__/photos.test.js`
Expected: PASS (все тесты `/photos`, включая новые 4 по `diagnose`)

- [ ] **Шаг 5: Проверить, что `buildApp` тестовый хелпер пробрасывает новые opts**

Открыть `backend/src/__tests__/helpers/buildApp.js`, убедиться, что он передаёt произвольные `opts` в `app.register(require('../../routes/photos'), opts)` без белого списка ключей (если список полей ограничен — добавить `aiDiagnosisService`/`fsPromises` явно).

- [ ] **Шаг 6: Также вернуть `ai_diagnosis`/`ai_diagnosed_at` в `GET /photos`**

В `backend/src/routes/photos.js`, в `GET /` — добавить поля в SELECT:

```js
      `SELECT pp.id, pp.planting_id, pp.action_id, pp.caption, pp.taken_at, pp.width, pp.height,
              pp.ai_diagnosis, pp.ai_diagnosed_at
       FROM planting_photos pp
```

(строка в существующем коде — просто дописать два поля в список колонок, запрос не меняется структурно)

- [ ] **Шаг 7: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js
git commit -m "feat(ai-diagnosis): POST /photos/:id/diagnose, closed-set по crop_id (F2)"
```

---

### Task 4: Деплой-конфиг (VPS)

**Files:**
- Modify: `.env` на проде (не в git — вручную на VPS через `ssh`)

- [ ] **Шаг 1: Добавить переменные окружения на проде**

```bash
AI_DIAGNOSIS_API_KEY=sk-ws-...   # ключ Qwen (DashScope international)
AI_DIAGNOSIS_MODEL=qwen-vl-plus  # опционально, это и так дефолт
```

`AI_DIAGNOSIS_BASE_URL` не задавать — дефолт `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` уже правильный.

- [ ] **Шаг 2: Прогнать миграцию 066 на проде**

```bash
psql -f backend/src/db/migrations/066_photo_ai_diagnosis.sql -U postgres -d dacha
```

(конкретная команда — как в `DEPLOY.md`/CONVENTIONS для прогона миграций на этом проекте; сверить точный вызов там перед прогоном)

- [ ] **Шаг 3: Рестарт backend-процесса, смоук-тест**

```bash
curl -X POST https://dacha.studio1008.com/photos/<реальный_id_фото>/diagnose \
  -H "Authorization: Bearer <токен demo@dacha.ru>"
```

Expected: `200` с `candidates` (если аккаунт demo помечен как подписанный/промо) либо `402` (если нет) — оба ответа подтверждают, что роут жив.

---

## Phase 2 — Web

### Task 5: API-клиент + типы

**Files:**
- Modify: `web/src/api/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Шаг 1: Добавить тип в `web/src/api/types.ts`**

Рядом с `PlantingPhoto` (см. существующее определение) дописать поле и новый тип:

```ts
export interface AiDiagnosisCandidate {
  id: number
  name: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface AiDiagnosisResult {
  candidates: AiDiagnosisCandidate[]
  disclaimer: string
  diagnosed_at: string
}
```

И расширить `PlantingPhoto`:

```ts
export interface PlantingPhoto {
  // ...существующие поля...
  ai_diagnosis?: AiDiagnosisCandidate[] | null
  ai_diagnosed_at?: string | null
}
```

- [ ] **Шаг 2: Добавить метод в `web/src/api/client.ts`**

В объект `api` (рядом с `uploadPhoto`/`deletePhoto`):

```ts
  diagnosePhoto: (photoId: number) =>
    request<AiDiagnosisResult>(`/photos/${photoId}/diagnose`, { method: 'POST' }),
```

Добавить импорт типа `AiDiagnosisResult` в блок импортов из `./types` наверху файла.

- [ ] **Шаг 3: Commit**

```bash
git add web/src/api/types.ts web/src/api/client.ts
git commit -m "feat(web): API-клиент для AI-диагностики фото (F2)"
```

---

### Task 6: UI в `PhotoDiary.tsx`

**Files:**
- Modify: `web/src/components/PhotoDiary.tsx`

- [ ] **Шаг 1: Добавить состояние и обработчик диагностики**

В компонент `PhotoDiary`, рядом с существующими `useState`:

```tsx
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagError, setDiagError] = useState<string | null>(null)

  const runDiagnosis = async (photo: PlantingPhoto) => {
    setDiagBusy(true)
    setDiagError(null)
    try {
      const result = await api.diagnosePhoto(photo.id)
      const updated = { ...photo, ai_diagnosis: result.candidates, ai_diagnosed_at: result.diagnosed_at }
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? updated : p)))
      setViewer(updated)
    } catch (err) {
      setDiagError(
        err instanceof ApiError && err.status === 402
          ? SUBSCRIPTION_REQUIRED_MESSAGE
          : 'Не удалось определить болезнь/вредителя'
      )
    } finally {
      setDiagBusy(false)
    }
  }
```

Добавить импорт `SUBSCRIPTION_REQUIRED_MESSAGE` из `../api/client` в существующую строку импорта.

- [ ] **Шаг 2: Добавить кнопку и результат в модалку просмотра**

В блоке `{viewer && (...)}`, в нижней `Column`/`div` с датой/подписью (после `{viewer.caption && ...}`), дописать:

```tsx
            {viewer.ai_diagnosis && viewer.ai_diagnosis.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1.5 rounded-btn bg-white/10 p-3">
                {viewer.ai_diagnosis.map((c) => (
                  <p key={c.id} className="text-sm text-white">
                    <span className="font-bold">Похоже на: {c.name}</span>
                    <span className="text-white/70"> — {c.reasoning}</span>
                  </p>
                ))}
                <p className="text-xs text-white/50">Предварительная оценка ИИ — сверьтесь со справочником.</p>
              </div>
            ) : (
              <button
                type="button"
                className="dacha-chip mt-2 px-3 py-2 text-sm"
                disabled={diagBusy}
                onClick={() => runDiagnosis(viewer)}
              >
                {diagBusy ? 'Определяю…' : '🔍 Определить болезнь/вредителя'}
              </button>
            )}
            {diagError && <p className="mt-1 text-xs font-bold text-red-400">{diagError}</p>}
```

- [ ] **Шаг 3: Ручная проверка**

`preview_start` c `dacha-web`, залогиниться `demo@dacha.ru`/`demo1234`, открыть посадку с фото в дневнике → «Определить» → убедиться, что приходит результат либо явная ошибка (402/503 — оба валидны в зависимости от того, настроен ли ключ и подписка demo-аккаунта).

- [ ] **Шаг 4: Commit**

```bash
git add web/src/components/PhotoDiary.tsx
git commit -m "feat(web): кнопка и результат AI-диагностики в дневнике фото (F2)"
```

---

## Phase 3 — Android

### Task 7: Модель + API + Repository

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/repository/PhotosRepository.kt`
- Test: `android/app/src/test/java/ru/dachakalend/app/photos/PhotosRepositoryTest.kt`

- [ ] **Шаг 1: Расширить `PlantingPhoto` и добавить модели ответа в `Models.kt`**

Рядом с `data class PlantingPhoto` дописать поля и новые классы:

```kotlin
data class PlantingPhoto(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "action_id") val actionId: Int? = null,
    val caption: String? = null,
    @Json(name = "taken_at") val takenAt: String,
    val width: Int? = null,
    val height: Int? = null,
    val url: String,
    @Json(name = "thumb_url") val thumbUrl: String,
    @Json(name = "ai_diagnosis") val aiDiagnosis: List<AiDiagnosisCandidate>? = null,
    @Json(name = "ai_diagnosed_at") val aiDiagnosedAt: String? = null,
)

data class AiDiagnosisCandidate(
    val id: Int,
    val name: String,
    val confidence: String,
    val reasoning: String,
)

data class AiDiagnosisResult(
    val candidates: List<AiDiagnosisCandidate>,
    val disclaimer: String,
    @Json(name = "diagnosed_at") val diagnosedAt: String,
)
```

- [ ] **Шаг 2: Добавить эндпоинт в `DachaApi.kt`**

Рядом с существующими фото-методами (`getPhotos`/`uploadPhoto`/`deletePhoto`):

```kotlin
    @POST("photos/{id}/diagnose")
    suspend fun diagnosePhoto(@Path("id") id: Int): AiDiagnosisResult
```

- [ ] **Шаг 3: Написать падающий тест для Repository**

```kotlin
package ru.dachakalend.app.photos

import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.AiDiagnosisCandidate
import ru.dachakalend.app.data.model.AiDiagnosisResult
import ru.dachakalend.app.data.repository.PhotosRepository
import ru.dachakalend.app.data.repository.Result

class PhotosRepositoryDiagnoseTest {

    @Test
    fun `diagnosePhoto happy path возвращает кандидатов`() = runTest {
        val api = mockk<DachaApi>()
        val expected = AiDiagnosisResult(
            candidates = listOf(AiDiagnosisCandidate(8, "Фитофтороз", "high", "обоснование")),
            disclaimer = "Предварительная оценка",
            diagnosedAt = "2026-08-09T00:00:00Z",
        )
        coEvery { api.diagnosePhoto(1) } returns expected

        val repo = PhotosRepository(api)
        val result = repo.diagnosePhoto(1)

        assertTrue(result is Result.Success)
        assertEquals(1, (result as Result.Success).data.candidates.size)
    }

    @Test
    fun `diagnosePhoto 402 возвращает Result Error`() = runTest {
        val api = mockk<DachaApi>()
        coEvery { api.diagnosePhoto(1) } throws HttpException(
            Response.error<AiDiagnosisResult>(402, okhttp3.ResponseBody.create(null, ""))
        )

        val repo = PhotosRepository(api)
        val result = repo.diagnosePhoto(1)

        assertTrue(result is Result.Error)
    }
}
```

- [ ] **Шаг 4: Убедиться, что тест падает**

Run: `cd android && ./gradlew testDebugUnitTest --tests "ru.dachakalend.app.photos.PhotosRepositoryDiagnoseTest"`
Expected: FAIL — `diagnosePhoto` не существует в `PhotosRepository`

- [ ] **Шаг 5: Добавить метод в `PhotosRepository.kt`**

```kotlin
    suspend fun diagnosePhoto(photoId: Int): Result<AiDiagnosisResult> = try {
        Result.Success(api.diagnosePhoto(photoId))
    } catch (e: Exception) {
        errorResult(e, "Не удалось определить болезнь/вредителя")
    }
```

(добавить импорт `ru.dachakalend.app.data.model.AiDiagnosisResult` наверх файла)

- [ ] **Шаг 6: Прогнать тест — PASS**

Run: `cd android && ./gradlew testDebugUnitTest --tests "ru.dachakalend.app.photos.PhotosRepositoryDiagnoseTest"`
Expected: PASS (2 теста)

- [ ] **Шаг 7: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt \
        android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt \
        android/app/src/main/java/ru/dachakalend/app/data/repository/PhotosRepository.kt \
        android/app/src/test/java/ru/dachakalend/app/photos/PhotosRepositoryDiagnoseTest.kt
git commit -m "feat(android): модель/API/Repository AI-диагностики фото (F2)"
```

---

### Task 8: ViewModel + UI в `PlantingInfoScreen.kt`

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoViewModel.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoScreen.kt`

- [ ] **Шаг 1: Добавить состояние и метод в `PlantingInfoViewModel.kt`**

Рядом с существующими методами (`uploadPhoto`/`deletePhoto`/`replacePhoto`), используя тот же паттерн обновления `uiState` (найти, как `replacePhoto` мутирует список `photos` в стейте, и повторить для diagnosis):

```kotlin
    private val photosRepository: PhotosRepository, // если ещё не внедрён в конструктор — добавить в @Inject constructor

    fun diagnosePhoto(photo: PlantingPhoto) {
        viewModelScope.launch {
            when (val result = photosRepository.diagnosePhoto(photo.id)) {
                is Result.Success -> {
                    val updated = photo.copy(
                        aiDiagnosis = result.data.candidates,
                        aiDiagnosedAt = result.data.diagnosedAt,
                    )
                    _uiState.update { s ->
                        s.copy(photos = s.photos.map { if (it.id == photo.id) updated else it })
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(error = result.message) }
                }
            }
        }
    }
```

(сверить точное имя поля состояния — `_uiState`/`uiState` и структуру `PlantingInfoUiState` перед вставкой; повторить сигнатуру `update`/`copy`, которую уже использует соседний метод `replacePhoto` в этом же файле)

- [ ] **Шаг 2: Прокинуть колбэк в `AboutTab` → `PhotoViewerDialog`**

В `PlantingInfoScreen.kt`, в вызове `AboutTab` (см. Task 0 из `PlantingInfoScreen` — параметр `onUpload`/`onDelete`), добавить:

```kotlin
                        onDiagnose = viewModel::diagnosePhoto,
```

В сигнатуру `AboutTab` (там, где объявлены `onUpload`, `onDelete` и т.д.) добавить параметр:

```kotlin
    onDiagnose: (PlantingPhoto) -> Unit,
```

Прокинуть его дальше в вызов `PhotoViewerDialog` (см. блок `viewer?.let { p -> PhotoViewerDialog(...) }`):

```kotlin
            onDiagnose = { onDiagnose(p) },
```

- [ ] **Шаг 3: Добавить кнопку/результат в `PhotoViewerDialog`**

В сигнатуру `PhotoViewerDialog` добавить параметр `onDiagnose: () -> Unit`. В нижнем `Column` (где сейчас `Text(formatShort(photo.takenAt)...)` и `photo.caption`), дописать после caption:

```kotlin
                if (!photo.aiDiagnosis.isNullOrEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .background(Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        photo.aiDiagnosis.forEach { c ->
                            Text(
                                "Похоже на: ${c.name}",
                                color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
                            )
                            Text(c.reasoning, color = Color(0xB3FFFFFF), fontFamily = NunitoFamily, fontSize = 13.sp)
                            Spacer(Modifier.height(4.dp))
                        }
                        Text(
                            "Предварительная оценка ИИ — сверьтесь со справочником.",
                            color = Color(0x80FFFFFF), fontFamily = NunitoFamily, fontSize = 11.sp
                        )
                    }
                } else {
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onDiagnose) {
                        Text(
                            "🔍 Определить болезнь/вредителя",
                            color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
                        )
                    }
                }
```

(нужные импорты `RoundedCornerShape`, `sp` — проверить, что уже импортированы в файле; `RoundedCornerShape` есть в шапке файла судя по другим композаблам в этом же скрине)

- [ ] **Шаг 4: Собрать и проверить вручную**

Run: `cd android && ./gradlew assembleGplayDebug` (или использовать `run`-скилл проекта, если он покрывает Android-сборку/эмулятор)
Expected: сборка без ошибок компиляции. Вручную: открыть посадку с фото → фото без диагноза показывает кнопку, после нажатия (при живом ключе на бэкенде) — результат с обоснованием.

- [ ] **Шаг 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoViewModel.kt \
        android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoScreen.kt
git commit -m "feat(android): UI AI-диагностики в просмотрщике фото посадки (F2)"
```

---

## Self-Review Checklist (для агента при исполнении)

- [ ] Все 8 задач покрывают: миграцию, сервис Qwen, роут+гейт подписки, деплой-конфиг, веб API+UI, Android модель/API/repo+UI.
- [ ] Closed-set промпт — кандидаты всегда только из `guide_entries` конкретной культуры (не открытый вопрос) — Task 3, Шаг 3.
- [ ] Ответ — топ-2/3 кандидата с обоснованием, не единственный диагноз — заложено в `SYSTEM`-промпте сервиса (Task 2) и в UI обоих платформ (Task 6, Task 8).
- [ ] Дисклеймер «предварительно» — есть в ответе бэкенда (Task 3) и продублирован в UI веба/Android (Task 6, Task 8) на случай, если фронт не покажет текст с бэка.
- [ ] Платный гейт (`hasAccess`) — Task 3, до похода в Qwen (не тратим токены на неоплативших).
- [ ] Нет свободного open-set промпта нигде в плане.
