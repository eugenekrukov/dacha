# Единое снуз/удаление задач дня — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести снуз/удаление карточек задач дня с локального Android-хранилища на сервер, чтобы Android и веб видели одинаковое состояние, и добавить такой же UI на веб.

**Architecture:** Новая таблица `today_task_dismissals` + `POST /today/tasks/dismiss` (upsert с серверным TTL) + `GET /today/tasks/dismissed` (для бейджа на экране «Посадки»). `GET /today` фильтрует список задач по активным дисмиссалам перед отдачей — оба клиента получают уже урезанный список. Android online-only (без ActionQueue), веб — новые иконки на карточке задачи.

**Tech Stack:** Backend — Fastify + PostgreSQL (vitest), Android — Kotlin/Compose/Hilt/Retrofit (JUnit+MockK), Web — React/TS (без юнит-тестов, только тайпчек+ручная проверка).

**Spec:** `docs/superpowers/specs/2026-06-27-unified-task-dismiss-design.md`

---

## Backend

### Task 1: Миграция `today_task_dismissals`

**Files:**
- Create: `backend/src/db/migrations/054_today_task_dismissals.sql`

- [ ] **Step 1: Написать миграцию**

```sql
-- 054_today_task_dismissals.sql
-- Единое серверное хранение снуза/удаления карточек задач дня (Android+Web), чтобы скрытая
-- на одной платформе карточка не продолжала показываться на другой.

CREATE TABLE IF NOT EXISTS today_task_dismissals (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    VARCHAR(150) NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('snooze','delete')),
  target_date DATE NOT NULL,
  client_id   VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, task_key)
);

CREATE INDEX IF NOT EXISTS today_task_dismissals_lookup
  ON today_task_dismissals(user_id, target_date);
```

- [ ] **Step 2: Прогнать миграцию локально**

Run: `cd backend && npm run migrate`
Expected: в выводе строка `✅ 054_today_task_dismissals.sql`, без ошибок.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/054_today_task_dismissals.sql
git commit -m "feat(backend): добавить таблицу today_task_dismissals"
```

---

### Task 2: `taskKey()` в `todayLogic.js`

**Files:**
- Modify: `backend/src/utils/todayLogic.js:451` (текущий `module.exports`)
- Test: `backend/src/__tests__/unit/todayLogic.test.js`

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `backend/src/__tests__/unit/todayLogic.test.js` (после последнего `describe`, перед закрывающей частью файла):

```js
const { taskKey } = require('../../utils/todayLogic')

describe('taskKey', () => {
  it('строит ключ из type/planting_id/crop_name/care_task_name', () => {
    const key = taskKey({
      type: 'care_task_due', planting_id: 5, crop_name: 'Огурец', care_task_name: 'Прищипка',
    })
    expect(key).toBe('care_task_due:5:Огурец:Прищипка')
  })

  it('null-поля сериализует как литерал "null" (как Kotlin-интерполяция)', () => {
    const key = taskKey({
      type: 'watering_due', planting_id: null, crop_name: null, care_task_name: null,
    })
    expect(key).toBe('watering_due:null:null:null')
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/unit/todayLogic.test.js -t taskKey`
Expected: FAIL — `taskKey is not a function` (экспорта пока нет).

- [ ] **Step 3: Реализовать `taskKey()`**

В `backend/src/utils/todayLogic.js` добавить функцию сразу после `formatTasks` (перед строкой
`module.exports = { ... }`, текущая строка 451):

```js
// Стабильный ключ задачи дня — для серверного снуза/удаления (today_task_dismissals).
// Зеркало Kotlin taskSnoozeKey() на Android: "${type}:${plantingId}:${cropName}:${careTaskName}".
function taskKey(t) {
  return `${t.type}:${t.planting_id}:${t.crop_name}:${t.care_task_name}`
}
```

Обновить экспорт (текущая строка 451):

```js
module.exports = { buildTasks, formatTasks, getNextCareTask, getOverdueCareTask, careTaskActionType, wateringIntervalDays, effectivePlantedAt, CARE_ACTION_TYPES, OVERDUE_WINDOW_DAYS, taskKey }
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `cd backend && npx vitest run src/__tests__/unit/todayLogic.test.js -t taskKey`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/todayLogic.js backend/src/__tests__/unit/todayLogic.test.js
git commit -m "feat(backend): экспортировать taskKey() из todayLogic"
```

---

### Task 3: `POST /today/tasks/dismiss`

**Files:**
- Modify: `backend/src/routes/today.js:1-3` (импорт), конец файла перед закрывающей `}` (текущая строка 157)
- Test: `backend/src/__tests__/today.test.js`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `backend/src/__tests__/today.test.js` новый `describe`-блок (после существующего
`describe('GET /today', ...)`, перед концом файла):

```js
describe('POST /today/tasks/dismiss', () => {
  let app, token, queries

  beforeEach(async () => {
    queries = []
    const mockDb = {
      query: async (sql, params) => {
        queries.push({ sql: sql.trim().split('\n')[0], params })
        return { rows: [] }
      },
    }
    app = await buildApp(mockDb)
    token = makeToken(app)
  })
  afterEach(async () => app.close())

  it('400 без task_key', async () => {
    const res = await supertest(app.server)
      .post('/today/tasks/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'snooze' })
    expect(res.status).toBe(400)
  })

  it('400 при недопустимом action', async () => {
    const res = await supertest(app.server)
      .post('/today/tasks/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_key: 'watering_due:1:Огурец:null', action: 'archive' })
    expect(res.status).toBe(400)
  })

  it('204 и upsert с target_date=сегодня+1 для snooze', async () => {
    const res = await supertest(app.server)
      .post('/today/tasks/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_key: 'watering_due:1:Огурец:null', action: 'snooze' })
    expect(res.status).toBe(204)
    const insert = queries.find(q => q.sql.includes('INSERT INTO today_task_dismissals'))
    expect(insert.params).toEqual([1, 'watering_due:1:Огурец:null', 'snooze', 1])
  })

  it('204 и upsert с target_date=сегодня+21 для delete', async () => {
    const res = await supertest(app.server)
      .post('/today/tasks/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_key: 'watering_due:1:Огурец:null', action: 'delete' })
    expect(res.status).toBe(204)
    const insert = queries.find(q => q.sql.includes('INSERT INTO today_task_dismissals'))
    expect(insert.params).toEqual([1, 'watering_due:1:Огурец:null', 'delete', 21])
  })
})
```

(`token = makeToken(app)` без второго аргумента кодирует `userId: 1` — см. `helpers/buildApp.js:86`
`function makeToken(fastify, userId = 1, ...)`, поэтому `params[0]` в тестах ниже равен `1`.)

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd backend && npx vitest run src/__tests__/today.test.js -t "POST /today/tasks/dismiss"`
Expected: FAIL — `404` (роута пока нет).

- [ ] **Step 3: Реализовать роут**

В `backend/src/routes/today.js` изменить импорт (строка 3):

```js
const { buildTasks, formatTasks, taskKey, OVERDUE_WINDOW_DAYS } = require('../utils/todayLogic')
```

Добавить роут перед закрывающей `}` модуля (после `})` блока `GET '/'`, текущая строка 156):

```js
  // POST /today/tasks/dismiss — отложить (снуз) или скрыть (удалить) карточку задачи дня.
  // Задачи дня не имеют своей строки в БД (buildTasks — чистая функция), поэтому скрытие
  // храним отдельно по task_key с TTL: снуз — до завтра, удаление — на OVERDUE_WINDOW_DAYS
  // (та же константа, что и так ограничивает срок жизни любой просроченной задачи — удаление
  // технически не может спрятать подлинно новый цикл задачи дольше, чем она и без удаления
  // была бы видна).
  fastify.post('/tasks/dismiss', auth, async (request, reply) => {
    const { task_key, action } = request.body
    if (!task_key || typeof task_key !== 'string') {
      return reply.code(400).send({ error: 'task_key required' })
    }
    if (action !== 'snooze' && action !== 'delete') {
      return reply.code(400).send({ error: 'action must be "snooze" or "delete"' })
    }

    const days = action === 'snooze' ? 1 : OVERDUE_WINDOW_DAYS
    await fastify.db.query(
      `INSERT INTO today_task_dismissals (user_id, task_key, action, target_date)
       VALUES ($1, $2, $3, CURRENT_DATE + $4::int)
       ON CONFLICT (user_id, task_key)
       DO UPDATE SET action = EXCLUDED.action, target_date = EXCLUDED.target_date, created_at = NOW()`,
      [request.user.userId, task_key, action, days]
    )
    return reply.code(204).send()
  })
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `cd backend && npx vitest run src/__tests__/today.test.js -t "POST /today/tasks/dismiss"`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/today.js backend/src/__tests__/today.test.js
git commit -m "feat(backend): добавить POST /today/tasks/dismiss"
```

---

### Task 4: `GET /today/tasks/dismissed`

**Files:**
- Modify: `backend/src/routes/today.js` (новый роут рядом с предыдущим)
- Test: `backend/src/__tests__/today.test.js`

- [ ] **Step 1: Написать падающий тест**

Добавить в `describe('POST /today/tasks/dismiss', ...)` или новый соседний блок в
`backend/src/__tests__/today.test.js`:

```js
describe('GET /today/tasks/dismissed', () => {
  it('возвращает task_keys активных дисмиссалов пользователя', async () => {
    const mockDb = {
      query: async (sql, params) => {
        if (sql.includes('FROM today_task_dismissals')) {
          expect(params).toEqual([1])
          return { rows: [{ task_key: 'watering_due:1:Огурец:null' }, { task_key: 'care_task_due:2:Томат:Подвязка' }] }
        }
        return { rows: [] }
      },
    }
    const app = await buildApp(mockDb)
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/today/tasks/dismissed')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ task_keys: ['watering_due:1:Огурец:null', 'care_task_due:2:Томат:Подвязка'] })
    await app.close()
  })
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/today.test.js -t "GET /today/tasks/dismissed"`
Expected: FAIL — `404`.

- [ ] **Step 3: Реализовать роут**

В `backend/src/routes/today.js` добавить сразу после роута `POST /tasks/dismiss`:

```js
  // GET /today/tasks/dismissed — список активных task_key (для бейджа на «Посадках»,
  // где индикатор «требует внимания» должен учитывать снуз/удаление с «Сегодня»).
  fastify.get('/tasks/dismissed', auth, async (request) => {
    const result = await fastify.db.query(
      `SELECT task_key FROM today_task_dismissals WHERE user_id=$1 AND target_date > CURRENT_DATE`,
      [request.user.userId]
    )
    return { task_keys: result.rows.map(r => r.task_key) }
  })
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `cd backend && npx vitest run src/__tests__/today.test.js -t "GET /today/tasks/dismissed"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/today.js backend/src/__tests__/today.test.js
git commit -m "feat(backend): добавить GET /today/tasks/dismissed"
```

---

### Task 5: Фильтрация `GET /today` по активным дисмиссалам

**Files:**
- Modify: `backend/src/routes/today.js:111-135` (между блоком напоминаний и `return`)
- Test: `backend/src/__tests__/today.test.js` (хелпер `buildTodayMockDb`)

- [ ] **Step 1: Расширить мок-БД и написать падающий тест**

В `backend/src/__tests__/today.test.js` обновить `buildTodayMockDb` (текущие строки 53-67), добавив
параметр `dismissedKeys` и ветку для новой таблицы:

```js
function buildTodayMockDb({ garden = GARDEN, weather = null, plantings = [], lastActions = [], reminders = [], dismissedKeys = [] } = {}) {
  const calls = []
  return {
    query: async (sql) => {
      calls.push(sql.trim().split('\n')[0])
      if (sql.includes('FROM gardens')) return { rows: garden ? [garden] : [] }
      if (sql.includes('FROM weather_snapshots')) return { rows: weather ? [weather] : [] }
      if (sql.includes('FROM plantings')) return { rows: plantings }
      if (sql.includes('FROM action_logs')) return { rows: lastActions }
      if (sql.includes('FROM reminders')) return { rows: reminders }
      if (sql.includes('FROM today_task_dismissals')) return { rows: dismissedKeys.map(k => ({ task_key: k })) }
      return { rows: [] }
    },
    _calls: calls,
  }
}
```

Добавить тест в `describe('GET /today', ...)`:

```js
  it('не показывает задачу с активным дисмиссалом', async () => {
    const planting = makePlanting({ id: 1, watering_freq_days: 1 })
    app = await buildApp(buildTodayMockDb({
      plantings: [planting],
      dismissedKeys: ['watering_due:null:null:null'],
    }))
    token = makeToken(app)

    const res = await supertest(app.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.tasks.find(t => t.type === 'watering_due')).toBeUndefined()
  })
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd backend && npx vitest run src/__tests__/today.test.js -t "активным дисмиссалом"`
Expected: FAIL — задача всё ещё присутствует в `res.body.tasks` (фильтрации пока нет).

- [ ] **Step 3: Реализовать фильтрацию**

В `backend/src/routes/today.js` добавить после блока напоминаний (после текущей строки 129,
закрывающей `const reminderTasks = ...`):

```js
    // ── 4.5 АКТИВНЫЕ ДИСМИССАЛЫ (снуз/удаление задач дня, единое для Android+Web) ───────────
    const dismissalsRes = await fastify.db.query(
      `SELECT task_key FROM today_task_dismissals WHERE user_id=$1 AND target_date > CURRENT_DATE`,
      [request.user.userId]
    )
    const dismissedKeys = new Set(dismissalsRes.rows.map(r => r.task_key))
```

Изменить текущую строку 133 и блок `return` (строки 132-152): после
`const topTasks = formatTasks(rawTasks)` добавить фильтр и использовать его в `return`:

```js
    const rawTasks = buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminderTasks, today, careActionsToday, weather?.precip_prob_pct ?? null, lastCareActionMap)
    const topTasks = formatTasks(rawTasks)
    const visibleTasks = topTasks.filter(t => !dismissedKeys.has(taskKey(t)))

    return {
      garden_id: garden.id,
      garden_name: garden.name,
      weather: weather ? {
        temp_c:          weather.temp_c        != null ? parseFloat(weather.temp_c)        : null,
        temp_min:        weather.min_temp_c    != null ? parseFloat(weather.min_temp_c)    : null,
        temp_max:        weather.max_temp_c    != null ? parseFloat(weather.max_temp_c)    : null,
        humidity:        weather.humidity_pct,
        condition:       weather.condition,
        condition_text:  weather.condition_text,
        frost_risk:      weather.frost_risk,
        heat_risk:       weather.heat_risk,
        precip_prob_pct: weather.precip_prob_pct ?? null,
        soil_temp_c:     weather.soil_temp_c   != null ? parseFloat(weather.soil_temp_c)  : null,
      } : null,
      forecast: weather?.forecast_json ?? [],
      tasks:           visibleTasks,
      tasks_total:     rawTasks.length,
      reminders_today: reminderTasks.length,
      generated_at:    today.toISOString(),
    }
```

- [ ] **Step 4: Убедиться, что все тесты `today.test.js` проходят**

Run: `cd backend && npx vitest run src/__tests__/today.test.js`
Expected: PASS (все тесты файла, включая старые).

- [ ] **Step 5: Прогнать весь backend-набор**

Run: `cd backend && npm test`
Expected: PASS (356+ тестов, без регрессий).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/today.js backend/src/__tests__/today.test.js
git commit -m "feat(backend): фильтровать GET /today по активным дисмиссалам"
```

---

## Android

### Task 6: API-методы и модель ответа

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt:190-193`
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt:74` (после `TodayResponse`)

- [ ] **Step 1: Добавить модель ответа**

В `Models.kt` добавить сразу после `data class TodayResponse(...)` (после текущей строки 74):

```kotlin
@JsonClass(generateAdapter = true)
data class DismissedTasksResponse(
    @Json(name = "task_keys") val taskKeys: List<String> = emptyList()
)
```

- [ ] **Step 2: Добавить методы в `DachaApi`**

В `DachaApi.kt` добавить сразу после `getToday` (текущие строки 191-192):

```kotlin
    @POST("today/tasks/dismiss")
    suspend fun dismissTask(@Body body: Map<String, String>)

    @GET("today/tasks/dismissed")
    suspend fun getDismissedTaskKeys(): DismissedTasksResponse
```

- [ ] **Step 3: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt
git commit -m "feat(android): добавить dismissTask/getDismissedTaskKeys в DachaApi"
```

---

### Task 7: `TodayViewModel` — снуз/удаление через API

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayViewModel.kt:65-103` и `209-211`
- Test: `android/app/src/test/java/ru/dachakalend/app/today/TodayViewModelTest.kt`

- [ ] **Step 1: Написать падающий тест**

Добавить в `TodayViewModelTest.kt` (после последнего `@Test`, перед закрывающей `}` класса):

```kotlin
    // ── Снуз/удаление задач дня (сервер, без TokenStorage) ──────────────────────

    @Test
    fun `snoozeTask оптимистично скрывает карточку и шлёт POST на сервер`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())
        coEvery { api.dismissTask(any()) } returns Unit

        val vm = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.snoozeTask("watering_due:1:Огурец:null")
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue("watering_due:1:Огурец:null" in vm.pendingHiddenTasks.value)
        coVerify { api.dismissTask(mapOf("task_key" to "watering_due:1:Огурец:null", "action" to "snooze")) }
    }

    @Test
    fun `deleteTask оптимистично скрывает карточку и шлёт POST с action=delete`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())
        coEvery { api.dismissTask(any()) } returns Unit

        val vm = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.deleteTask("harvest_due:2:Томат:null")
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue("harvest_due:2:Томат:null" in vm.pendingHiddenTasks.value)
        coVerify { api.dismissTask(mapOf("task_key" to "harvest_due:2:Томат:null", "action" to "delete")) }
    }
```

Добавить импорт `io.mockk.coVerify` в начало файла (рядом с существующими `io.mockk.*`).

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "*TodayViewModelTest*"`
Expected: COMPILE ERROR — `pendingHiddenTasks` и текущая сигнатура `snoozeTask`/`deleteTask` не вызывают `api.dismissTask`.
(Если тест-раннер в этом окружении не запускается из-за известного бага с кириллическим путём —
см. `session-note.md` 2026-06-25 — верификацией считается успешная компиляция тест-сорсов, см. Step 4 ниже.)

- [ ] **Step 3: Переписать снуз/удаление в `TodayViewModel.kt`**

Удалить строки 73-77 (`_snoozedTasks`/`_deletedTasks`) и заменить на:

```kotlin
    private val _pendingHiddenTasks = MutableStateFlow<Set<String>>(emptySet())
    val pendingHiddenTasks: StateFlow<Set<String>> = _pendingHiddenTasks.asStateFlow()
```

Заменить блок `snoozeTask`/`deleteTask` (текущие строки 89-103) на:

```kotlin
    fun snoozeTask(key: String) {
        _pendingHiddenTasks.value = _pendingHiddenTasks.value + key
        viewModelScope.launch {
            try { api.dismissTask(mapOf("task_key" to key, "action" to "snooze")) } catch (_: Exception) {}
        }
    }

    fun deleteTask(key: String) {
        _pendingHiddenTasks.value = _pendingHiddenTasks.value + key
        viewModelScope.launch {
            try { api.dismissTask(mapOf("task_key" to key, "action" to "delete")) } catch (_: Exception) {}
        }
    }
```

Убрать второй аргумент `tokenStorage.getSnoozedTasksForToday()` из вызова `attentionCount` внутри
`loadToday()` (текущая строка 210) — заменить на `emptySet()`, поскольку `pending` там уже построен из
серверного (отфильтрованного) `todayResult.data.tasks`:

```kotlin
                tokenStorage.saveAttentionCount(
                    attentionCount(plantingsList, pending, emptySet())
                )
```

- [ ] **Step 4: Скомпилировать тест-сорсы и прогнать (если раннер работает в этом окружении)**

Run: `cd android && ./gradlew :app:compileGplayDebugUnitTestKotlin`
Expected: BUILD SUCCESSFUL.

Run (если возможно в текущем окружении): `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "*TodayViewModelTest*"`
Expected: PASS (все тесты файла).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/today/TodayViewModel.kt android/app/src/test/java/ru/dachakalend/app/today/TodayViewModelTest.kt
git commit -m "feat(android): снуз/удаление задач дня через сервер вместо TokenStorage"
```

---

### Task 8: `TodayScreen.kt` — фильтрация по `pendingHiddenTasks`

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt:89-92,142-145`

- [ ] **Step 1: Заменить чтение стейта**

Заменить текущие строки 89-92:

```kotlin
    val dismissedRecs by viewModel.dismissedRecs.collectAsState()
    val deletedRecs   by viewModel.deletedRecs.collectAsState()
    val snoozedTasks  by viewModel.snoozedTasks.collectAsState()
    val deletedTasks  by viewModel.deletedTasks.collectAsState()
```

на:

```kotlin
    val dismissedRecs by viewModel.dismissedRecs.collectAsState()
    val deletedRecs   by viewModel.deletedRecs.collectAsState()
    val pendingHiddenTasks by viewModel.pendingHiddenTasks.collectAsState()
```

- [ ] **Step 2: Обновить фильтр задач**

Заменить текущие строки 142-145:

```kotlin
                    tasks         = state.data.today.tasks.filterNot { task ->
                        val key = taskSnoozeKey(task)
                        key in snoozedTasks || key in deletedTasks
                    },
```

на:

```kotlin
                    tasks         = state.data.today.tasks.filterNot { task ->
                        taskSnoozeKey(task) in pendingHiddenTasks
                    },
```

- [ ] **Step 3: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt
git commit -m "feat(android): TodayScreen фильтрует задачи по pendingHiddenTasks"
```

---

### Task 9: `PlantingsViewModel` — дисмиссалы с сервера

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsViewModel.kt:73-79,114-135,285-293`

- [ ] **Step 1: Добавить `DachaApi` в конструктор**

Заменить текущие строки 73-79:

```kotlin
@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val tokenStorage: TokenStorage,
    savedStateHandle: SavedStateHandle
) : ViewModel() {
```

на:

```kotlin
@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val tokenStorage: TokenStorage,
    private val api: ru.dachakalend.app.data.api.DachaApi,
    savedStateHandle: SavedStateHandle
) : ViewModel() {
```

- [ ] **Step 2: Заменить источник `snoozed` в `loadPlantings()`**

Заменить текущие строки 114-135:

```kotlin
    fun loadPlantings(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            val pending = tokenStorage.getPendingTasks()
            val snoozed = tokenStorage.getSnoozedTasksForToday()
            when (val result = plantingsRepository.getPlantings(gardenId)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        plantings = result.data,
                        isLoading = false,
                        pendingTasks = pending,
                        snoozedTaskKeys = snoozed
                    )
                    // Бейдж = то, что реально подсвечено на карточках (карточки server-driven).
                    tokenStorage.saveAttentionCount(attentionCount(result.data, pending, snoozed))
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }
```

на:

```kotlin
    fun loadPlantings(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            val pending = tokenStorage.getPendingTasks()
            val snoozed = try { api.getDismissedTaskKeys().taskKeys.toSet() } catch (_: Exception) { emptySet() }
            when (val result = plantingsRepository.getPlantings(gardenId)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        plantings = result.data,
                        isLoading = false,
                        pendingTasks = pending,
                        snoozedTaskKeys = snoozed
                    )
                    // Бейдж = то, что реально подсвечено на карточках (карточки server-driven).
                    tokenStorage.saveAttentionCount(attentionCount(result.data, pending, snoozed))
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }
```

- [ ] **Step 3: Убрать устаревшее синхронное чтение в `closeActionSheet()`**

Заменить текущие строки 285-293:

```kotlin
    fun closeActionSheet() {
        // Закрытие без записи НЕ снимает pending (иначе индикатор и счётчик
        // рассинхронятся, а после /today задача вернётся). Чистим только в onActionLogged.
        _uiState.value = _uiState.value.copy(
            showActionSheet = null,
            snoozedTaskKeys = tokenStorage.getSnoozedTasksForToday()
        )
        loadPlantings(silent = true)
    }
```

на:

```kotlin
    fun closeActionSheet() {
        // Закрытие без записи НЕ снимает pending (иначе индикатор и счётчик
        // рассинхронятся, а после /today задача вернётся). Чистим только в onActionLogged.
        // snoozedTaskKeys не обновляем синхронно здесь — loadPlantings() ниже перечитает
        // актуальный набор с сервера.
        _uiState.value = _uiState.value.copy(showActionSheet = null)
        loadPlantings(silent = true)
    }
```

- [ ] **Step 4: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsViewModel.kt
git commit -m "feat(android): PlantingsViewModel читает дисмиссалы с сервера вместо TokenStorage"
```

---

### Task 10: `CalendarViewModel` — убрать мёртвый код снуза

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/calendar/CalendarViewModel.kt:9,37,55,85-90,195-221`

- [ ] **Step 1: Убрать инъекцию `TokenStorage` и импорт**

Убрать строку 9 (`import ru.dachakalend.app.data.local.TokenStorage`).

Заменить конструктор (текущие строки 35-38):

```kotlin
class CalendarViewModel @Inject constructor(
    private val repository: CalendarRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {
```

на:

```kotlin
class CalendarViewModel @Inject constructor(
    private val repository: CalendarRepository
) : ViewModel() {
```

- [ ] **Step 2: Убрать вызов в `load()`**

Заменить текущие строки 50-56:

```kotlin
                    val events = buildEvents(
                        result.data.reminders,
                        result.data.plantings,
                        result.data.crops,
                        result.data.todayTasks,
                        tokenStorage.getSnoozedTasksForCalendar()
                    )
```

на:

```kotlin
                    val events = buildEvents(
                        result.data.reminders,
                        result.data.plantings,
                        result.data.crops,
                        result.data.todayTasks
                    )
```

- [ ] **Step 3: Убрать параметр и мёртвую ветку из `buildEvents()`**

Заменить сигнатуру (текущие строки 85-90):

```kotlin
    private fun buildEvents(
        reminders: List<Reminder>,
        plantings: List<Planting>,
        crops: List<Crop>,
        todayTasks: List<TodayTask> = emptyList(),
        snoozedTasks: List<TokenStorage.SnoozedCalendarTask> = emptyList()
    ): Map<LocalDate, List<DayEvent>> {
```

на:

```kotlin
    private fun buildEvents(
        reminders: List<Reminder>,
        plantings: List<Planting>,
        crops: List<Crop>,
        todayTasks: List<TodayTask> = emptyList()
    ): Map<LocalDate, List<DayEvent>> {
```

Удалить блок «Отложенные задачи — показываем на целевую дату» целиком (текущие строки 195-221, от
комментария `// Отложенные задачи — показываем на целевую дату` до закрывающей `}` перед `return result`).

- [ ] **Step 4: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/calendar/CalendarViewModel.kt
git commit -m "refactor(android): убрать мёртвый код отображения снуза в календаре"
```

---

### Task 11: `TokenStorage` — удалить мёртвый код

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/local/TokenStorage.kt:201-263,323-351`
- Modify: `android/CONVENTIONS.md:558-567`

- [ ] **Step 1: Удалить секцию «Снуз / постоянное удаление задач»**

Удалить из `TokenStorage.kt` весь блок от комментария
`// ─── Снуз / постоянное удаление задач ────...` (текущая строка 201) до конца функции
`getDeletedTasks()` (текущая строка 263) включительно — это:
`SnoozedCalendarTask`, `snoozeTask()`, `getSnoozedTasksForToday()`, `getSnoozedTasksForCalendar()`,
`deleteTask()`, `getDeletedTasks()`.

Секцию «Постоянное удаление рекомендаций» (`deleteRec`/`getDeletedRecs`, текущие строки 190-199) —
**не трогать**, она не относится к задачам дня.

- [ ] **Step 2: Удалить константы**

В `companion object` (текущие строки 323-351) удалить строки:

```kotlin
        private const val KEY_SNOOZED_TASKS   = "snoozed_tasks"
        private const val KEY_DELETED_TASKS   = "deleted_tasks"
```

- [ ] **Step 3: Обновить таблицу в `CONVENTIONS.md`**

В `android/CONVENTIONS.md` заменить таблицу (текущие строки 559-567):

```markdown
| Метод | Описание |
|---|---|
| `addDismissedRec(key)` | Скрыть рекомендацию на сегодня |
| `deleteRec(key)` | Удалить рекомендацию навсегда |
| `getDeletedRecs()` | Навсегда удалённые рекомендации |
```

(строки про `snoozeTask`/`deleteTask`/`getSnoozedTasksForToday`/`getDeletedTasks` убраны — снуз/удаление
задач дня теперь серверные, см. `docs/superpowers/specs/2026-06-27-unified-task-dismiss-design.md`.)

- [ ] **Step 4: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin :app:compileGplayDebugUnitTestKotlin`
Expected: BUILD SUCCESSFUL (если что-то ссылается на удалённые методы — компилятор укажет файл/строку,
доделать пропущенный call site).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/local/TokenStorage.kt android/CONVENTIONS.md
git commit -m "refactor(android): удалить мёртвый локальный снуз/удаление задач дня из TokenStorage"
```

---

### Task 12: Полная компиляция Android (все флейворы)

**Files:** нет изменений, только верификация.

- [ ] **Step 1: Скомпилировать все флейворы + тест-сорсы**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin :app:compileRustoreDebugKotlin :app:compileGplayDebugUnitTestKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: Прогнать unit-тесты (если раннер работает в этом окружении)**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest`
Expected: PASS. Если в этом окружении тест-воркер не запускается (известный баг с кириллическим путём
проекта, см. `summary.md` про E3) — компиляция из Step 1 считается достаточной верификацией; тесты
прогнать в Android Studio или на ASCII-пути перед публикацией.

---

## Web

### Task 13: `taskKey()` и метод API-клиента

**Files:**
- Modify: `web/src/api/schedule.ts` (рядом с `careTaskActionType`)
- Modify: `web/src/api/client.ts:237` (рядом с `getToday`)

- [ ] **Step 1: Добавить `taskKey()`**

`TodayTask` уже импортирован в файле (строка 1: `import type { ActionLog, CareTask, Crop, Planting, TodayTask } from './types'`).
В `web/src/api/schedule.ts` добавить экспортируемую функцию (рядом с `careTaskActionType`):

```ts
// Стабильный ключ задачи дня — зеркало Kotlin taskSnoozeKey() на Android и taskKey() в todayLogic.js.
export function taskKey(t: TodayTask): string {
  return `${t.type}:${t.planting_id}:${t.crop_name}:${t.care_task_name}`
}
```

- [ ] **Step 2: Добавить метод в `client.ts`**

В `web/src/api/client.ts` добавить сразу после `getToday` (текущая строка 237):

```ts
  dismissTask: (taskKey: string, action: 'snooze' | 'delete') =>
    request<void>('/today/tasks/dismiss', { method: 'POST', body: { task_key: taskKey, action } }),
```

- [ ] **Step 3: Тайпчек**

Run: `cd web && npx tsc -b --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/schedule.ts web/src/api/client.ts
git commit -m "feat(web): добавить taskKey() и api.dismissTask()"
```

---

### Task 14: Иконки снуз/удаление на `TaskCard`

**Files:**
- Modify: `web/src/screens/TodayScreen.tsx:1-11,72-111,286-336`

- [ ] **Step 1: Добавить обработчик в `TodayScreen`**

Добавить импорт `taskKey` в начало `TodayScreen.tsx` (рядом с существующим импортом из `../api/schedule`,
текущая строка 6):

```ts
import { careTaskActionType, treatmentNote, taskKey } from '../api/schedule'
```

Внутри компонента `TodayScreen` добавить функцию (рядом с `dismiss`, после текущей строки 108):

```ts
  const dismissTask = (t: TodayTask, action: 'snooze' | 'delete') => {
    setToday(prev => (prev ? { ...prev, tasks: prev.tasks.filter((x) => x !== t) } : prev))
    api.dismissTask(taskKey(t), action).catch(() => load())
  }
```

- [ ] **Step 2: Передать обработчик в `TaskCard`**

Заменить вызовы `<TaskCard key={i} t={t} onLog={setLogTask} />` и `<TaskCard key={i} t={t} />`
(текущие строки 201 и 211) на:

```tsx
                currentTasks.map((t, i) => <TaskCard key={i} t={t} onLog={setLogTask} onDismiss={dismissTask} />)
```
```tsx
                upcomingTasks.map((t, i) => <TaskCard key={i} t={t} onDismiss={dismissTask} />)
```

- [ ] **Step 3: Добавить иконки в `TaskCard`**

Изменить сигнатуру `TaskCard` (текущая строка 286):

```tsx
function TaskCard({ t, onLog, onDismiss }: { t: TodayTask; onLog?: (t: TodayTask) => void; onDismiss?: (t: TodayTask, action: 'snooze' | 'delete') => void }) {
```

(`Clock` и `X` уже импортированы в файле — строка 3: `import { Droplet, Snowflake, Flame, Clock, CircleCheck, X } from 'lucide-react'`.)

Заменить существующий блок `{overdue && (...)}` (текущие строки 310-318) на:

```tsx
      {(overdue || onDismiss) && (
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
          {overdue && (
            <span
              className={`flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-bold ${
                critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Clock size={13} aria-hidden /> {t.days_overdue} дн.
            </span>
          )}
          {onDismiss && t.type !== 'reminder' && (
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(t, 'snooze') }}
                aria-label="Отложить на завтра"
                title="На завтра"
                className="text-muted"
              >
                <Clock size={18} aria-hidden />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(t, 'delete') }}
                aria-label="Удалить"
                title="Удалить"
                className="text-muted"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Тайпчек и сборка**

Run: `cd web && npm run build`
Expected: без ошибок TypeScript, сборка завершается успешно.

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/TodayScreen.tsx
git commit -m "feat(web): добавить снуз/удаление задач дня на карточке (паритет с Android)"
```

---

### Task 15: Ручная проверка в превью

**Files:** нет изменений, только верификация.

- [ ] **Step 1: Запустить дев-сервер веба и открыть «Сегодня» с тестовым аккаунтом**

Используй `preview_start`/`preview_screenshot` (или `npm run dev` вручную) на `web/`, авторизуйся
тест-аккаунтом (см. memory `reference_dacha_credentials` или `demo@dacha.ru`/`demo1234` из `summary.md`).

- [ ] **Step 2: Проверить обе иконки на карточке задачи**

Кликнуть «Clock» (отложить) на одной карточке → карточка исчезает из списка немедленно; обновить
страницу → карточка не возвращается (т.к. снуз действует до завтра).
Кликнуть «X» (удалить) на другой карточке → то же, но не возвращается дольше (до 21 дня/смены цикла).
Сделать `preview_screenshot` до и после клика как подтверждение.

- [ ] **Step 3: Проверить кросс-платформенность вручную (если есть доступ к Android-сборке/эмулятору)**

Снузнуть задачу на Android (или curl от имени того же пользователя через
`POST /today/tasks/dismiss`) → перезагрузить веб → карточка должна быть скрыта и там. Это и есть
непосредственная проверка исходного бага.
