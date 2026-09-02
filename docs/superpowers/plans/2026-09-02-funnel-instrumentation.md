# Инструментация воронки регистрация→оплата — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать `/statistic_funnel` два новых шага («упёрся в лимит», «paywall открыт») и задействовать уже существующие данные о начатой оплате — заменить мёртвый шаг «старт триала» на реальную картину, где отваливаются пользователи между первой посадкой и оплатой.

**Architecture:** Два новых `TIMESTAMPTZ`-поля на `users` (`limit_hit_at`, `paywall_opened_at`), ставятся один раз через `WHERE ... IS NULL`. Серверный маркер `markLimitHit` вызывается в 7 существующих точках 402-ответов (лимит посадок / `isPlantingLocked`). Клиентское событие «paywall открыт» шлётся новым `POST /analytics/paywall-opened` с обеих платформ при показе экрана. `payments.status IN ('pending','succeeded')` уже покрывает «начал оплату» без изменений кода.

**Tech Stack:** Fastify + PostgreSQL (backend, тесты vitest — `npm test`), React + TypeScript (web, тест-раннера нет — `npm run typecheck`), Kotlin/Compose (android, `./gradlew test`).

**Спека:** `docs/superpowers/specs/2026-09-02-funnel-instrumentation-design.md`

---

## File Structure

**Backend**
- Create: `backend/src/db/migrations/089_funnel_events.sql` — колонки `users.limit_hit_at`, `users.paywall_opened_at`.
- Modify: `backend/src/utils/access.js` — новая функция `markLimitHit(db, userId)`.
- Modify: `backend/src/routes/plantings.js` — 3 вызова `markLimitHit` (создание сверх лимита, PATCH `/:id/stage`, PATCH `/:id/info`).
- Modify: `backend/src/routes/actions.js`, `harvests.js`, `photos.js`, `reminders.js` — по одному вызову `markLimitHit` в каждом.
- Modify: `backend/src/routes/analytics.js` — новый роут `POST /analytics/paywall-opened`.
- Test: `backend/src/__tests__/access.test.js`, `backend/src/__tests__/plantings.test.js`, `backend/src/__tests__/actions.test.js`, `backend/src/__tests__/harvests.test.js`, `backend/src/__tests__/photos.test.js`, `backend/src/__tests__/reminders.test.js`, `backend/src/__tests__/analytics.test.js` (все дополняются).

**Web**
- Modify: `web/src/api/client.ts` — `markPaywallOpened()`.
- Modify: `web/src/screens/PaywallScreen.tsx` — вызов при маунте.

**Android**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt` — `markPaywallOpened()`.
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/paywall/PaywallViewModel.kt` — вызов в `init`.

**Отчёт**
- Modify: `.claude/skills/statistic_funnel/SKILL.md` — новые шаги, убран «старт триала».

**Docs**
- Modify: `docs/ux-roadmap.md`, `session-note.md`, `summary.md`.

Backend-задачи (1-8) должны идти по порядку (миграция → хелпер → wiring → эндпоинт) —
каждая следующая опирается на предыдущую. Web (9) и Android (10) не зависят друг от друга и
от отчёта (11) — можно в любом порядке после Task 8.

---

## Task 1: Миграция — `users.limit_hit_at` / `users.paywall_opened_at`

**Files:**
- Create: `backend/src/db/migrations/089_funnel_events.sql`

- [ ] **Step 1: Написать миграцию**

Создать `backend/src/db/migrations/089_funnel_events.sql`:

```sql
-- Migration 089: два поля-таймстампа для воронки регистрация→оплата.
--
-- ПРИЧИНА: бизнес-статус на 2026-09-02 — 71 реальный пользователь, 0 платящих. Существующий
-- /statistic_funnel не может показать, где отваливаются: между «1-я посадка» и «оплатили» нет
-- промежуточных шагов. Дизайн: docs/superpowers/specs/2026-09-02-funnel-instrumentation-design.md.
--
-- Оба поля — таймстамп ПЕРВОГО события, дальше не перезаписываются (тот же паттерн, что
-- email_verified/trial_started_at). Не отдельная таблица событий — в проекте её нет, заводить
-- ради двух точек избыточно (см. спеку).
--
-- limit_hit_at — пользователь получил 402 (лимит посадок или заблокированная посадка сверх
-- free-набора). Ставится в backend/src/utils/access.js:markLimitHit, вызывается из routes/
-- plantings.js, actions.js, harvests.js, photos.js, reminders.js.
--
-- paywall_opened_at — пользователь открыл экран пейволла (web/Android). Ставится в
-- POST /analytics/paywall-opened.
--
-- Идемпотентна: ADD COLUMN IF NOT EXISTS, безопасно перегонять повторно.

ALTER TABLE users ADD COLUMN IF NOT EXISTS limit_hit_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paywall_opened_at TIMESTAMPTZ;

COMMENT ON COLUMN users.limit_hit_at IS
  'Таймстамп первого 402 по free-лимиту посадок (создание сверх лимита или заблокированная посадка). NULL — ни разу не упирался.';
COMMENT ON COLUMN users.paywall_opened_at IS
  'Таймстамп первого открытия экрана пейволла (web/Android). NULL — ни разу не открывал.';
```

- [ ] **Step 2: Прогнать миграцию локально**

Run: `cd backend && npm run migrate`
Expected: в выводе строка про `089_funnel_events`, процесс завершается без ошибок. Если
локальной БД нет (`ECONNREFUSED`) — это ожидаемо в некоторых окружениях; миграция
применяется на прод отдельно при деплое (см. `docs/DEPLOY.md`), этот шаг не блокирует
дальнейшую работу над кодом.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/089_funnel_events.sql
git commit -m "feat(db): users.limit_hit_at + users.paywall_opened_at для воронки"
```

---

## Task 2: `markLimitHit` в `access.js`

**Files:**
- Modify: `backend/src/utils/access.js`
- Test: `backend/src/__tests__/access.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/access.test.js` изменить строку импорта в начале файла

```js
const { hasAccess, isSubscribed, hasPromo, isLifetimePromo, LIFETIME_UNTIL, isAdSupportedStore, FREE_PLANTING_LIMIT, isPlantingLocked, freeTierState } = require('../utils/access')
```

на

```js
const { hasAccess, isSubscribed, hasPromo, isLifetimePromo, LIFETIME_UNTIL, isAdSupportedStore, FREE_PLANTING_LIMIT, isPlantingLocked, freeTierState, markLimitHit } = require('../utils/access')
```

и добавить в конец файла новый `describe`:

```js
describe('access.markLimitHit (воронка: первый упор в free-лимит)', () => {
  it('ставит limit_hit_at, если он ещё не был установлен', async () => {
    let captured = null
    const db = { query: async (sql, params) => { captured = { sql, params }; return { rows: [] } } }

    await markLimitHit(db, 42)

    expect(captured.sql).toMatch(/UPDATE users SET limit_hit_at = NOW\(\)/)
    expect(captured.sql).toMatch(/WHERE id = \$1 AND limit_hit_at IS NULL/)
    expect(captured.params).toEqual([42])
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/access.test.js`
Expected: FAIL — `markLimitHit is not a function` (импорт даёт `undefined`).

- [ ] **Step 3: Реализовать**

В `backend/src/utils/access.js` добавить функцию после `isPlantingLocked` (перед
`extendSubscription`):

```js
/**
 * Отмечает первый упор пользователя в free-лимит (для воронки регистрация→оплата) —
 * таймстамп ставится один раз, повторные вызовы не перезаписывают. Вызывается рядом с
 * каждым существующим 402-ответом по лимиту посадок / isPlantingLocked, саму проверку
 * не меняет — см. docs/superpowers/specs/2026-09-02-funnel-instrumentation-design.md.
 */
async function markLimitHit(db, userId) {
  await db.query('UPDATE users SET limit_hit_at = NOW() WHERE id = $1 AND limit_hit_at IS NULL', [userId])
}
```

и добавить `markLimitHit` в `module.exports` в конце файла:

```js
module.exports = {
  SUBSCRIPTION_WINDOW_DAYS, PROMO_MONTH_DAYS, LIFETIME_UNTIL, FREE_PLANTING_LIMIT,
  isSubscribed, hasPromo, isLifetimePromo, hasAccess, extendSubscription,
  revokeSubscription, isAdSupportedStore, freeTierState, isPlantingLocked, markLimitHit
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/access.test.js`
Expected: PASS, все тесты файла зелёные.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/access.js backend/src/__tests__/access.test.js
git commit -m "feat(access): markLimitHit — отметка первого упора в free-лимит"
```

---

## Task 3: Wiring в `plantings.js` (3 точки)

**Files:**
- Modify: `backend/src/routes/plantings.js:101-102` (создание сверх лимита), `:270-271` (PATCH `/:id/stage`), `:309-310` (PATCH `/:id/info`)
- Test: `backend/src/__tests__/plantings.test.js`

- [ ] **Step 1: Импортировать `markLimitHit`**

В `backend/src/routes/plantings.js` строку

```js
const { hasAccess, FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')
```

заменить на

```js
const { hasAccess, FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
```

- [ ] **Step 2: Написать падающие тесты**

В `backend/src/__tests__/plantings.test.js` дополнить существующий тест «free-пользователь на
лимите» (строка ~55) — заменить

```js
  it('free-пользователь на лимите (3 активных посадки) → 402 plan_limit_reached', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql, { plantingCount: 3 })
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('plan_limit_reached')
    await app.close()
  })
```

на (добавлен захват UPDATE-запроса + проверка):

```js
  it('free-пользователь на лимите (3 активных посадки) → 402 plan_limit_reached + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        queries.push(sql)
        const gated = gateQuery(sql, { plantingCount: 3 })
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('plan_limit_reached')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
    await app.close()
  })
```

Аналогично дополнить два теста про заблокированную посадку (строки ~601 и ~613). Заменить

```js
  it('PATCH /:id/info по заблокированной посадке → 402 planting_locked', async () => {
    const app = await buildApp(lockedDb())
    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ quantity: 5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    await app.close()
  })

  it('PATCH /:id/stage по заблокированной посадке → 402', async () => {
    const app = await buildApp(lockedDb())
    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ stage: 'flowering' })

    expect(res.status).toBe(402)
    await app.close()
  })
```

на (расширяем `lockedDb`, чтобы отдавал захваченные запросы наружу):

```js
  it('PATCH /:id/info по заблокированной посадке → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql, params) => {
        queries.push(sql)
        return lockedDb().query(sql, params)
      },
    })
    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ quantity: 5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
    await app.close()
  })

  it('PATCH /:id/stage по заблокированной посадке → 402 + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql, params) => {
        queries.push(sql)
        return lockedDb().query(sql, params)
      },
    })
    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ stage: 'flowering' })

    expect(res.status).toBe(402)
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
    await app.close()
  })
```

- [ ] **Step 3: Прогнать тесты — убедиться, что новые проверки падают**

Run: `cd backend && npx vitest run src/__tests__/plantings.test.js`
Expected: FAIL на трёх тестах выше (`queries.some(...)` — `false`, `UPDATE users` ещё не
пишется); остальные тесты файла зелёные.

- [ ] **Step 4: Реализовать**

В `backend/src/routes/plantings.js` строку (создание сверх лимита, ~102)

```js
      if (parseInt(countRes.rows[0].count, 10) >= FREE_PLANTING_LIMIT) {
        return reply.code(402).send({ error: 'plan_limit_reached', limit: FREE_PLANTING_LIMIT })
      }
```

заменить на

```js
      if (parseInt(countRes.rows[0].count, 10) >= FREE_PLANTING_LIMIT) {
        await markLimitHit(fastify.db, request.user.userId)
        return reply.code(402).send({ error: 'plan_limit_reached', limit: FREE_PLANTING_LIMIT })
      }
```

В `PATCH /:id/stage` (~270) строку

```js
      if (isPlantingLocked(state, planting)) {
        return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
      }
```

(первое вхождение в файле после `PATCH /:id/stage`) заменить на

```js
      if (isPlantingLocked(state, planting)) {
        await markLimitHit(fastify.db, request.user.userId)
        return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
      }
```

В `PATCH /:id/info` (~309) — второе вхождение точно такого же блока — заменить так же:

```js
    if (isPlantingLocked(state, planting)) {
      await markLimitHit(fastify.db, request.user.userId)
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

**Не трогать** `isPlantingLocked` при `locked: isPlantingLocked(state, p)` в GET-роутах
(список посадок и деталь посадки, строки ~231 и ~257) — это информационное поле в ответе, не
402, отмечать как «упор в лимит» не нужно (см. спеку).

- [ ] **Step 5: Прогнать тесты — убедиться, что проходят**

Run: `cd backend && npx vitest run src/__tests__/plantings.test.js`
Expected: PASS, весь файл зелёный.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/plantings.js backend/src/__tests__/plantings.test.js
git commit -m "feat(plantings): отмечаем limit_hit_at на 402 по free-лимиту"
```

---

## Task 4: Wiring в `actions.js`

**Files:**
- Modify: `backend/src/routes/actions.js:3,37-39`
- Test: `backend/src/__tests__/actions.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/actions.test.js` заменить тест (~143)

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'growing' }] },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, action_type: 'watering' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
```

на (с захватом запросов и продолжением, `await app.close()` и закрывающая `})` остаются как
есть):

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql) => {
        queries.push(sql)
        return freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'growing' }] }
      },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, action_type: 'watering' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/actions.test.js`
Expected: FAIL на новой проверке `queries.some(...)`.

- [ ] **Step 3: Реализовать**

В `backend/src/routes/actions.js` строку

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')
```

заменить на

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
```

и блок

```js
    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

на

```js
    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      await markLimitHit(fastify.db, request.user.userId)
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/actions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/actions.js backend/src/__tests__/actions.test.js
git commit -m "feat(actions): отмечаем limit_hit_at на 402 planting_locked"
```

---

## Task 5: Wiring в `harvests.js`

**Files:**
- Modify: `backend/src/routes/harvests.js:3,43-45`
- Test: `backend/src/__tests__/harvests.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/harvests.test.js` заменить тест (~32)

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'harvesting' }] },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, weight_kg: 1.5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
```

на

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql) => {
        queries.push(sql)
        return freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'harvesting' }] }
      },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/harvests')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, weight_kg: 1.5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/harvests.test.js`
Expected: FAIL на новой проверке.

- [ ] **Step 3: Реализовать**

В `backend/src/routes/harvests.js` строку

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')
```

заменить на

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
```

и блок

```js
    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

на

```js
    const state = await freeTierState(fastify.db, request.user.userId)
    if (isPlantingLocked(state, planting)) {
      await markLimitHit(fastify.db, request.user.userId)
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/harvests.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/harvests.js backend/src/__tests__/harvests.test.js
git commit -m "feat(harvests): отмечаем limit_hit_at на 402 planting_locked"
```

---

## Task 6: Wiring в `photos.js`

**Files:**
- Modify: `backend/src/routes/photos.js:5,58-61`
- Test: `backend/src/__tests__/photos.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/photos.test.js` найти функцию `makeDb` (используется в тесте
«заблокированная посадка», ~108) и посмотреть её объявление в начале файла — она собирает мок
`db.query`. Заменить тест

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402, файл не обработан', async () => {
    const img = fakeImageService()
    const db = makeDb({ freeIds: [1, 2, 3] })   // посадка 5 вне свободного набора
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
```

на (оборачиваем `db.query`, чтобы захватить запросы, не трогая логику `makeDb`):

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402, файл не обработан, отмечен limit_hit_at', async () => {
    const img = fakeImageService()
    const queries = []
    const baseDb = makeDb({ freeIds: [1, 2, 3] })   // посадка 5 вне свободного набора
    const db = { ...baseDb, query: async (sql, params) => { queries.push(sql); return baseDb.query(sql, params) } }
    const app = await buildApp(db, { imageService: img })
    const res = await supertest(app.server)
      .post('/photos')
      .set('Authorization', `Bearer ${makeToken(app, 1)}`)
      .field('planting_id', '5')
      .attach('file', Buffer.from('x'), 'p.jpg')
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/photos.test.js`
Expected: FAIL на новой проверке.

- [ ] **Step 3: Реализовать**

В `backend/src/routes/photos.js` строку

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')
```

заменить на

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
```

и блок

```js
    const state = await freeTierState(fastify.db, userId)
    if (isPlantingLocked(state, planting)) {
      try { await data.toBuffer() } catch {}
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

на

```js
    const state = await freeTierState(fastify.db, userId)
    if (isPlantingLocked(state, planting)) {
      try { await data.toBuffer() } catch {}
      await markLimitHit(fastify.db, userId)
      return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
    }
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/photos.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/photos.js backend/src/__tests__/photos.test.js
git commit -m "feat(photos): отмечаем limit_hit_at на 402 planting_locked"
```

---

## Task 7: Wiring в `reminders.js`

**Files:**
- Modify: `backend/src/routes/reminders.js:3,25-27`
- Test: `backend/src/__tests__/reminders.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/reminders.test.js` заменить тест (~33)

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'growing' }] },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, remind_at: new Date().toISOString(), type: 'watering' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
```

на

```js
  it('заблокированная посадка (сверх free-набора, без подписки) → 402 planting_locked + отметка limit_hit_at', async () => {
    const queries = []
    const app = await buildApp({
      query: async (sql) => {
        queries.push(sql)
        return freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1, stage: 'growing' }] }
      },
    })
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, remind_at: new Date().toISOString(), type: 'watering' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    expect(queries.some((sql) => sql.includes('UPDATE users SET limit_hit_at'))).toBe(true)
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/reminders.test.js`
Expected: FAIL на новой проверке.

- [ ] **Step 3: Реализовать**

В `backend/src/routes/reminders.js` строку

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked } = require('../utils/access')
```

заменить на

```js
const { FREE_PLANTING_LIMIT, freeTierState, isPlantingLocked, markLimitHit } = require('../utils/access')
```

и блок

```js
      const state = await freeTierState(fastify.db, request.user.userId)
      if (isPlantingLocked(state, owns.rows[0])) {
        return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
      }
```

на

```js
      const state = await freeTierState(fastify.db, request.user.userId)
      if (isPlantingLocked(state, owns.rows[0])) {
        await markLimitHit(fastify.db, request.user.userId)
        return reply.code(402).send({ error: 'planting_locked', limit: FREE_PLANTING_LIMIT })
      }
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/reminders.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/reminders.js backend/src/__tests__/reminders.test.js
git commit -m "feat(reminders): отмечаем limit_hit_at на 402 planting_locked"
```

---

## Task 8: `POST /analytics/paywall-opened`

**Files:**
- Modify: `backend/src/routes/analytics.js`
- Test: `backend/src/__tests__/analytics.test.js`

- [ ] **Step 1: Написать падающий тест**

В `backend/src/__tests__/analytics.test.js` добавить новый `describe` перед
`describe('GET /analytics/summary', ...)`:

```js
describe('POST /analytics/paywall-opened', () => {
  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/analytics/paywall-opened')
    expect(res.status).toBe(401)
    await app.close()
  })

  it('с токеном → 204, ставит paywall_opened_at один раз', async () => {
    const queries = []
    const mockDb = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] } } }
    const app = await buildApp(mockDb)
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/analytics/paywall-opened')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
    expect(queries[0].sql).toMatch(/UPDATE users SET paywall_opened_at = NOW\(\)/)
    expect(queries[0].sql).toMatch(/WHERE id = \$1 AND paywall_opened_at IS NULL/)
    await app.close()
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/analytics.test.js`
Expected: FAIL — роута ещё нет, второй тест получает 404 вместо 204 (первый на 401 может уже
проходить, т.к. `fastify.authenticate` сам по себе применится ко всем защищённым методам —
не полагайся на это, важен второй тест).

- [ ] **Step 3: Реализовать**

В `backend/src/routes/analytics.js` добавить новый роут после `POST /first-open` (перед
`GET /summary`):

```js
  // POST /analytics/paywall-opened — фиксирует первое открытие экрана пейволла (воронка
  // регистрация→оплата). Идемпотентно, тело не нужно.
  fastify.post('/paywall-opened', auth, async (request, reply) => {
    await fastify.db.query(
      'UPDATE users SET paywall_opened_at = NOW() WHERE id = $1 AND paywall_opened_at IS NULL',
      [request.user.userId]
    )
    reply.code(204).send()
  })
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/analytics.test.js`
Expected: PASS, весь файл зелёный.

- [ ] **Step 5: Прогнать весь бэкенд-набор — регрессий быть не должно**

Run: `cd backend && npm test`
Expected: PASS, ни один существующий тест не покраснел.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/analytics.js backend/src/__tests__/analytics.test.js
git commit -m "feat(analytics): POST /analytics/paywall-opened"
```

---

## Task 9: Web — вызов при открытии пейволла

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/src/screens/PaywallScreen.tsx`

- [ ] **Step 1: Добавить метод в API-клиент**

В `web/src/api/client.ts` после строки

```js
  getAnalytics: () => request<AnalyticsSummary>('/analytics/summary'),
```

добавить:

```js
  // Фиксирует первое открытие экрана пейволла (воронка регистрация→оплата). Best-effort —
  // вызывающий код глотает ошибку, показ пейволла не должен от этого зависеть.
  markPaywallOpened: () => request<void>('/analytics/paywall-opened', { method: 'POST' }),
```

- [ ] **Step 2: Вызвать при маунте `PaywallScreen`**

В `web/src/screens/PaywallScreen.tsx` после существующего

```ts
  useEffect(() => {
    api
      .getAnalytics()
      .then((a) => setProgress({ plantings: a.plantings_count ?? 0, actions: a.total_actions ?? 0 }))
      .catch(() => {})
  }, [])
```

добавить ещё один эффект:

```ts
  // Воронка регистрация→оплата: фиксируем первое открытие пейволла. Best-effort, ошибку
  // не показываем — второстепенное событие не должно мешать основному сценарию оплаты.
  useEffect(() => {
    api.markPaywallOpened().catch(() => {})
  }, [])
```

- [ ] **Step 3: Проверить типы**

Run: `cd web && npm run typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/client.ts web/src/screens/PaywallScreen.tsx
git commit -m "feat(web): фиксируем открытие пейволла для воронки"
```

---

## Task 10: Android — вызов при открытии пейволла

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/paywall/PaywallViewModel.kt`

- [ ] **Step 1: Добавить метод в `DachaApi`**

В `DachaApi.kt` после

```kotlin
    @GET("analytics/summary")
    suspend fun getAnalyticsSummary(): AnalyticsSummary
```

добавить:

```kotlin
    // Фиксирует первое открытие экрана пейволла (воронка регистрация→оплата).
    @POST("analytics/paywall-opened")
    suspend fun markPaywallOpened()
```

- [ ] **Step 2: Вызвать в `init` вьюмодели**

В `PaywallViewModel.kt` в блоке `init` после существующего блока с `getAnalyticsSummary`
(внутри того же `init`, отдельным `viewModelScope.launch`):

```kotlin
        // Воронка регистрация→оплата: фиксируем первое открытие пейволла. Best-effort,
        // ошибку глотаем — второстепенное событие не должно мешать показу экрана.
        viewModelScope.launch {
            try { api.markPaywallOpened() } catch (_: Exception) { }
        }
```

- [ ] **Step 3: Собрать**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt android/app/src/main/java/ru/dachakalend/app/ui/paywall/PaywallViewModel.kt
git commit -m "feat(android): фиксируем открытие пейволла для воронки"
```

---

## Task 11: Обновить `/statistic_funnel`

**Files:**
- Modify: `.claude/skills/statistic_funnel/SKILL.md`

- [ ] **Step 1: Переписать SQL и описание шагов**

В `.claude/skills/statistic_funnel/SKILL.md` заменить блок SQL

```sql
WITH ru AS (
  SELECT id, email_verified, trial_started_at FROM users WHERE is_test = false
)
SELECT
  (SELECT count(*) FROM ru)                                              AS "Регистрации",
  (SELECT count(*) FROM ru WHERE email_verified)                        AS "Email подтв.",
  (SELECT count(DISTINCT g.user_id)
     FROM gardens g JOIN ru ON ru.id = g.user_id)                       AS "Участок создан",
  (SELECT count(DISTINCT g.user_id)
     FROM plantings p JOIN gardens g ON g.id = p.garden_id
     JOIN ru ON ru.id = g.user_id)                                      AS "1-я посадка",
  (SELECT count(*) FROM ru WHERE trial_started_at IS NOT NULL)          AS "Старт триала",
  (SELECT count(DISTINCT pay.user_id)
     FROM payments pay JOIN ru ON ru.id = pay.user_id
     WHERE pay.status = 'succeeded')                                    AS "Оплатили";
```

на

```sql
WITH ru AS (
  SELECT id, email_verified, limit_hit_at, paywall_opened_at FROM users WHERE is_test = false
)
SELECT
  (SELECT count(*) FROM ru)                                              AS "Регистрации",
  (SELECT count(*) FROM ru WHERE email_verified)                        AS "Email подтв.",
  (SELECT count(DISTINCT g.user_id)
     FROM gardens g JOIN ru ON ru.id = g.user_id)                       AS "Участок создан",
  (SELECT count(DISTINCT g.user_id)
     FROM plantings p JOIN gardens g ON g.id = p.garden_id
     JOIN ru ON ru.id = g.user_id)                                      AS "1-я посадка",
  (SELECT count(*) FROM ru WHERE limit_hit_at IS NOT NULL)              AS "Упёрся в лимит",
  (SELECT count(*) FROM ru WHERE paywall_opened_at IS NOT NULL)         AS "Paywall открыт",
  (SELECT count(DISTINCT pay.user_id)
     FROM payments pay JOIN ru ON ru.id = pay.user_id
     WHERE pay.status IN ('pending', 'succeeded'))                      AS "Оплата начата",
  (SELECT count(DISTINCT pay.user_id)
     FROM payments pay JOIN ru ON ru.id = pay.user_id
     WHERE pay.status = 'succeeded')                                    AS "Оплатили";
```

Заменить раздел «## Определения шагов» — убрать пункт «Старт триала», добавить перед
«Оплатили»:

```markdown
- **Упёрся в лимит** — `limit_hit_at IS NOT NULL` (получил 402 по free-лимиту посадок хотя бы раз).
- **Paywall открыт** — `paywall_opened_at IS NOT NULL` (открыл экран пейволла хотя бы раз).
- **Оплата начата** — есть строка в `payments` со статусом `pending` или `succeeded`
  (`POST /billing/create-payment` создаёт `pending` ещё до перехода на оплату; `pending`,
  не ставший `succeeded`, — брошенная оплата).
```

Обновить требования вверху файла (после строки про миграцию 041) — добавить:

```markdown
> ⚠️ Требует миграцию `089_funnel_events.sql` (колонки `users.limit_hit_at`,
> `users.paywall_opened_at`).
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/statistic_funnel/SKILL.md
git commit -m "docs(skill): /statistic_funnel — упор в лимит, paywall, оплата начата вместо старта триала"
```

---

## Task 12: Документация

**Files:**
- Modify: `docs/ux-roadmap.md`, `session-note.md`, `summary.md`

- [ ] **Step 1: Записать в `session-note.md`**

В `session-note.md` добавить запись о сессии (дата — на момент реализации), в том же формате,
что соседние записи: что сделано (миграция 089, `markLimitHit` в 7 точках, `POST
/analytics/paywall-opened`, вызовы с web+Android, обновлён `/statistic_funnel`), что открыто
(нужно накопить данные хотя бы за неделю, прежде чем делать выводы по воронке).

- [ ] **Step 2: Обновить `summary.md`**

В разделе «Бизнес-статус» (см. `## Бизнес-статус` в `summary.md`) добавить абзац о том, что
воронка теперь инструментирована — со ссылкой на `/statistic_funnel` как источник актуальных
цифр по шагам «упёрся в лимит» / «paywall открыт» / «оплата начата», вместо неинструментированной
воронки, упомянутой в записи от 2026-09-02.

- [ ] **Step 3: Обновить `docs/ux-roadmap.md`**

Найти в файле упоминание неинструментированной воронки (раздел с бизнес-приоритетами,
если такое упоминание есть — искать по тексту «не инструментирована») и отметить закрытым
со ссылкой на эту фичу: `docs/superpowers/{specs,plans}/2026-09-02-funnel-instrumentation*`.
Если отдельного упоминания в этом файле нет — пропустить шаг, ux-roadmap.md не источник
истины по бизнес-метрикам (им остаётся `summary.md`).

- [ ] **Step 4: Commit**

```bash
git add docs/ux-roadmap.md session-note.md summary.md
git commit -m "docs: воронка регистрация→оплата инструментирована"
```

---

## Финальная проверка

- [ ] `cd backend && npm test` — зелёный
- [ ] `cd web && npm run typecheck && npm run build` — без ошибок
- [ ] `cd android && ./gradlew test assembleDebug` — BUILD SUCCESSFUL
- [ ] `grep -rn "markLimitHit" backend/src/routes` — ровно 7 вызовов (plantings.js×3,
      actions.js, harvests.js, photos.js, reminders.js)
- [ ] Деплой (миграция 089 + backend + web) и релиз Android — только по отдельной просьбе
      владельца, как в предыдущих сессиях
