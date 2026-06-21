# F1 — Офлайн-режим «Сегодня»: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Сегодня» в Android-приложении открывается без сети из кэша, а действия (лог/смена стадии/удаление), сделанные офлайн, ставятся в очередь и синхронизируются при возврате связи — идемпотентно и с клиентским временем.

**Architecture:** Подход A (см. spec) — лёгкий самописный кэш (`TodayCache`) и очередь записи (`ActionQueue`), оба persisted через Moshi в `SharedPreferences`, без Room/WorkManager. Синхронизация (`ActionSyncManager`) под Mutex, триггеры: возврат связи (`ConnectivityObserver`), foreground, успешный `loadToday()`. Бэкенд добавляет `action_logs.client_id` (UUID, идемпотентность) и приём клиентского `logged_at`.

**Tech Stack:** Backend — Fastify + node-postgres, тесты vitest. Android — Kotlin, Hilt, Retrofit/Moshi, Coroutines/StateFlow; тесты JUnit4 + mockk + turbine + kotlinx-coroutines-test.

**Спека:** `docs/superpowers/specs/2026-06-21-offline-today-design.md`

---

## Карта файлов

**Backend**
- Создать: `backend/src/db/migrations/045_action_client_id.sql` — колонка `client_id` + частичный UNIQUE-индекс.
- Изменить: `backend/src/routes/actions.js` — приём `client_id`/`logged_at`, ON CONFLICT-дедуп.
- Изменить (тесты): `backend/src/__tests__/actions.test.js`.

**Android — модели/инфраструктура**
- Изменить: `data/model/Models.kt` — `CreateActionRequest` += `clientId`/`loggedAt`; `ActionLog` += `clientId`/`pending`.
- Изменить: `data/repository/TodayRepository.kt` — `Result.Error.isNetwork` + хелпер `errorResult`.
- Создать: `data/local/ActionQueue.kt` — `QueuedOp` + персистентная FIFO-очередь.
- Создать: `data/local/TodayCache.kt` — `CachedToday` + персистентный кэш экрана.
- Создать: `data/sync/ActionSyncManager.kt` — прогон очереди под Mutex.
- Создать: `data/sync/ConnectivityObserver.kt` — `NetworkCallback` → `sync()`.

**Android — интеграция**
- Изменить: `data/repository/ActionsRepository.kt` — clientId/loggedAt, enqueue при офлайне, оптимистичная синтетика, событие `loggedActionEvents`.
- Изменить: `data/repository/PlantingsRepository.kt` — классификация сетевой ошибки (через `errorResult`).
- Изменить: `ui/today/TodayViewModel.kt` — запись/чтение кэша, офлайн-флаг, оптимистичное закрытие задачи, вызов `syncManager.sync()`.
- Изменить: `ui/today/TodayScreen.kt` — баннер офлайн/очереди, пометка pending; `taskSnoozeKey`/`recKey` вынести в `TodayViewModel.kt`.
- Изменить: `App.kt` — старт `ConnectivityObserver`.
- Изменить (тесты): `app/src/test/.../today/TodayViewModelTest.kt`; создать `.../actions/ActionsRepositoryTest.kt`, `.../sync/ActionSyncManagerTest.kt`.

---

## Task 1: Backend — идемпотентность + клиентское время

**Files:**
- Create: `backend/src/db/migrations/045_action_client_id.sql`
- Modify: `backend/src/routes/actions.js:18-34`
- Test: `backend/src/__tests__/actions.test.js`

- [ ] **Step 1: Написать миграцию**

Создать `backend/src/db/migrations/045_action_client_id.sql`:

```sql
-- F1 офлайн «Сегодня»: идемпотентность офлайн-логирования действий.
-- client_id генерит клиент (UUID) при постановке в очередь; повторная отправка
-- того же действия (ретрай после частичного успеха) не задваивает строку.
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS action_logs_client_id_uniq
  ON action_logs (client_id)
  WHERE client_id IS NOT NULL;
```

- [ ] **Step 2: Написать падающие тесты**

Добавить в конец `describe('POST /actions', ...)` в `backend/src/__tests__/actions.test.js` (перед закрывающей `})` блока POST):

```js
  it('передаёт client_id и logged_at в INSERT', async () => {
    let insertParams
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO action_logs')) { insertParams = params; return { rows: [ACTION] } }
        return { rows: [{ id: 1 }] } // владелец найден
      },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planting_id: 1, type: 'watering',
        client_id: '11111111-1111-4111-8111-111111111111',
        logged_at: '2026-06-20T08:30:00.000Z',
      })

    expect(insertParams[4]).toBe('2026-06-20T08:30:00.000Z') // logged_at — 5-й параметр
    expect(insertParams[5]).toBe('11111111-1111-4111-8111-111111111111') // client_id — 6-й
    await app.close()
  })

  it('при конфликте client_id возвращает существующую строку (идемпотентно)', async () => {
    let selectCalled = false
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('INSERT INTO action_logs')) return { rows: [] }      // ON CONFLICT DO NOTHING
        if (sql.startsWith('SELECT * FROM action_logs WHERE client_id')) { selectCalled = true; return { rows: [ACTION] } }
        return { rows: [{ id: 1 }] }                                          // владелец
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'watering', client_id: '11111111-1111-4111-8111-111111111111' })

    expect(selectCalled).toBe(true)
    expect(res.status).toBe(201)
    expect(res.body.action_type).toBe('watering')
    await app.close()
  })

  it('кривой client_id → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ id: 1 }] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planting_id: 1, type: 'watering', client_id: 'not-a-uuid' })

    expect(res.status).toBe(400)
    await app.close()
  })
```

- [ ] **Step 3: Запустить тесты — убедиться, что падают**

Run: `cd backend && npx vitest run src/__tests__/actions.test.js`
Expected: FAIL — новые 3 теста (старый INSERT без `logged_at`/`client_id` параметров, нет SELECT-ветки, нет валидации UUID).

- [ ] **Step 4: Реализовать роут**

Заменить тело `fastify.post('/', ...)` в `backend/src/routes/actions.js` (строки ~18-34) на:

```js
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async (request, reply) => {
    const { planting_id, notes } = request.body
    const action_type = request.body.action_type ?? request.body.type
    const auto = request.body.auto === true // заметка подставлена автоматически (не введена юзером)
    const client_id = request.body.client_id ?? null
    const logged_at = request.body.logged_at ?? null

    // Валидация клиентских полей офлайн-очереди (F1)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (client_id !== null && !UUID_RE.test(client_id)) {
      return reply.code(400).send({ error: 'Некорректный client_id' })
    }
    if (logged_at !== null && Number.isNaN(Date.parse(logged_at))) {
      return reply.code(400).send({ error: 'Некорректный logged_at' })
    }

    // Защита от IDOR: нельзя писать в журнал чужой посадки
    if (!planting_id || !(await userOwnsPlanting(planting_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Planting not found or not yours' })
    }

    // logged_at: клиентское время (офлайн) либо NOW(); client_id — ключ идемпотентности.
    const insert = await fastify.db.query(
      `INSERT INTO action_logs (planting_id, action_type, notes, auto, logged_at, client_id)
       VALUES ($1,$2,$3,$4, COALESCE($5::timestamptz, NOW()), $6::uuid)
       ON CONFLICT (client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [planting_id, action_type, notes, auto, logged_at, client_id]
    )

    // ON CONFLICT DO NOTHING → 0 строк: действие уже записано, вернём существующее (идемпотентно).
    if (insert.rows.length === 0 && client_id) {
      const existing = await fastify.db.query(
        `SELECT * FROM action_logs WHERE client_id = $1`,
        [client_id]
      )
      return reply.code(201).send(existing.rows[0])
    }
    return reply.code(201).send(insert.rows[0])
  })
```

- [ ] **Step 5: Запустить тесты — убедиться, что проходят**

Run: `cd backend && npx vitest run src/__tests__/actions.test.js`
Expected: PASS (включая старые: `auto` теперь 4-й параметр — не сместился; `logged_at` 5-й, `client_id` 6-й).

- [ ] **Step 6: Прогнать весь бэкенд-сьют (регрессия)**

Run: `cd backend && npm test`
Expected: PASS, число тестов = прежнее (327) + 3.

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/migrations/045_action_client_id.sql backend/src/routes/actions.js backend/src/__tests__/actions.test.js
git commit -m "feat(actions): client_id-идемпотентность + клиентский logged_at (F1 backend)"
```

---

## Task 2: Android — `Result.Error.isNetwork` + классификация ошибок

Сетевую недоступность (офлайн) надо отличать от прикладных ошибок (HTTP 4xx/5xx). Retrofit бросает `java.io.IOException` при отсутствии связи и `retrofit2.HttpException` при не-2xx.

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/repository/TodayRepository.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/repository/PlantingsRepository.kt:31-34`

- [ ] **Step 1: Расширить `Result.Error` и добавить хелпер**

В `TodayRepository.kt` заменить `sealed class Result` и тело `getToday` на:

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val isNetwork: Boolean = false) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

/** Классификация исключения: отсутствие связи (IOException) → isNetwork=true; HTTP-ошибки → false. */
fun errorResult(e: Throwable, fallback: String): Result.Error =
    Result.Error(e.message ?: fallback, isNetwork = e is java.io.IOException)
```

И в `TodayRepository.getToday()` заменить `catch`:

```kotlin
        } catch (e: Exception) {
            errorResult(e, "Ошибка загрузки")
        }
```

- [ ] **Step 2: Применить классификацию в `PlantingsRepository.updateStage`**

В `PlantingsRepository.kt` заменить тело `updateStage`:

```kotlin
    suspend fun updateStage(plantingId: Int, stage: String): Result<Planting> = try {
        Result.Success(api.updatePlantingStage(plantingId, mapOf("stage" to stage)))
    } catch (e: Exception) {
        errorResult(e, "Ошибка смены стадии")
    }
```

(импорт `ru.dachakalend.app.data.repository.errorResult` не нужен — тот же пакет.)

- [ ] **Step 3: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin` (Windows: `JAVA_HOME` → JBR, см. session-note)
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/repository/TodayRepository.kt android/app/src/main/java/ru/dachakalend/app/data/repository/PlantingsRepository.kt
git commit -m "feat(offline): Result.Error.isNetwork + классификация ошибок (F1)"
```

---

## Task 3: Android — модели для очереди и кэша

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt:395-401` (`CreateActionRequest`), `:383-392` (`ActionLog`)

- [ ] **Step 1: Расширить `CreateActionRequest`**

Заменить `data class CreateActionRequest` в `Models.kt`:

```kotlin
@JsonClass(generateAdapter = true)
data class CreateActionRequest(
    @Json(name = "planting_id") val plantingId: Int,
    val type: String,
    val notes: String? = null,
    val auto: Boolean = false,
    // F1: идемпотентность офлайн-очереди + клиентское время записи.
    @Json(name = "client_id") val clientId: String? = null,
    @Json(name = "logged_at") val loggedAt: String? = null,
)
```

- [ ] **Step 2: Расширить `ActionLog`**

Заменить `data class ActionLog` в `Models.kt`:

```kotlin
@JsonClass(generateAdapter = true)
data class ActionLog(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "action_type") val type: String,
    val notes: String?,
    // true = заметка подставлена автоматически (имя задачи/удобрения) → скрываем в журнале
    val auto: Boolean = false,
    @Json(name = "logged_at") val loggedAt: String,
    // F1: client_id связывает запись с операцией очереди; pending=true — синтетическая
    // «оптимистичная» запись, ещё не подтверждённая сервером (рисуем «↑ ждёт отправки»).
    @Json(name = "client_id") val clientId: String? = null,
    val pending: Boolean = false,
)
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL (сервер `pending` не присылает → дефолт false; запись в кэш сериализует поле).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt
git commit -m "feat(offline): client_id/logged_at/pending в моделях действий (F1)"
```

---

## Task 4: Android — `ActionQueue` (персистентная очередь)

Тонкая обёртка над `SharedPreferences` (как `TokenStorage`). Логика синхронизации — в Task 6, оптимизма — в Task 7; здесь только хранение FIFO. Проверка — компиляцией (классы поверх `SharedPreferences` в проекте юнит-тестами не покрываются, ср. `TokenStorage`).

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/data/local/ActionQueue.kt`

- [ ] **Step 1: Создать `ActionQueue.kt`**

```kotlin
package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Одна отложенная мутация (F1). op: "LOG" | "STAGE" | "DELETE". */
@JsonClass(generateAdapter = true)
data class QueuedOp(
    val clientId: String,            // UUID — ключ идемпотентности
    val op: String,
    val plantingId: Int,
    // LOG
    val type: String? = null,
    val notes: String? = null,
    val auto: Boolean = false,
    val loggedAt: String? = null,    // ISO, клиентское время
    // STAGE
    val stage: String? = null,       // "transplanted"
    // DELETE
    val targetServerId: Int? = null,
    val targetClientId: String? = null,
    val createdAt: Long = 0L,
)

/**
 * Персистентная FIFO-очередь офлайн-мутаций (F1). Хранится в отдельном SharedPreferences-файле,
 * сериализация Moshi. Доступ синхронизирован — параллельная синхронизация и запись не должны
 * наслаиваться. size — реактивный размер для индикатора «N действий ждут отправки».
 */
@Singleton
class ActionQueue @Inject constructor(
    @param:ApplicationContext context: Context,
    moshi: Moshi,
) {
    private val prefs = context.getSharedPreferences("dacha_action_queue", Context.MODE_PRIVATE)
    private val adapter = moshi.adapter<List<QueuedOp>>(
        Types.newParameterizedType(List::class.java, QueuedOp::class.java)
    )

    private val _size = MutableStateFlow(load().size)
    val size: StateFlow<Int> = _size.asStateFlow()

    @Synchronized
    fun load(): List<QueuedOp> {
        val json = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { adapter.fromJson(json) }.getOrNull() ?: emptyList()
    }

    @Synchronized
    fun enqueue(op: QueuedOp) {
        val list = load().toMutableList()
        list.add(op)
        // Мягкий потолок: на дачный сценарий с запасом, отбрасываем самые старые.
        while (list.size > MAX) list.removeAt(0)
        persist(list)
    }

    @Synchronized
    fun remove(clientId: String) {
        persist(load().filterNot { it.clientId == clientId })
    }

    @Synchronized
    fun removeByTargetClientId(targetClientId: String): Boolean {
        val before = load()
        val after = before.filterNot { it.clientId == targetClientId }
        persist(after)
        return after.size != before.size
    }

    @Synchronized
    fun clear() = persist(emptyList())

    private fun persist(list: List<QueuedOp>) {
        prefs.edit { putString(KEY, adapter.toJson(list)) }
        _size.value = list.size
    }

    private companion object {
        const val KEY = "queue"
        const val MAX = 200
    }
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/local/ActionQueue.kt
git commit -m "feat(offline): ActionQueue — персистентная FIFO-очередь мутаций (F1)"
```

---

## Task 5: Android — `TodayCache` (кэш экрана «Сегодня»)

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/data/local/TodayCache.kt`

- [ ] **Step 1: Создать `TodayCache.kt`**

```kotlin
package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayResponse
import javax.inject.Inject
import javax.inject.Singleton

/** Снимок экрана «Сегодня» для офлайн-показа (F1). Привязан к gardenId. */
@JsonClass(generateAdapter = true)
data class CachedToday(
    val gardenId: Int,
    val cachedAt: Long,                         // epoch-millis
    val today: TodayResponse,
    val recommendations: List<Recommendation>,
    val plantings: List<Planting>,
    val todayActions: List<ActionLog>,
)

/**
 * Кэш последнего успешного «Сегодня» (F1). Один слот; при смене активного сада старый кэш
 * не отдаём (load возвращает null, если gardenId не совпал).
 */
@Singleton
class TodayCache @Inject constructor(
    @param:ApplicationContext context: Context,
    moshi: Moshi,
) {
    private val prefs = context.getSharedPreferences("dacha_today_cache", Context.MODE_PRIVATE)
    private val adapter = moshi.adapter(CachedToday::class.java)

    fun save(snapshot: CachedToday) {
        prefs.edit { putString(KEY, adapter.toJson(snapshot)) }
    }

    fun load(gardenId: Int): CachedToday? {
        val json = prefs.getString(KEY, null) ?: return null
        return runCatching { adapter.fromJson(json) }.getOrNull()?.takeIf { it.gardenId == gardenId }
    }

    /** Обновить только ленту действий (оптимизм при офлайн-логе). No-op, если кэша нет. */
    fun updateActions(transform: (List<ActionLog>) -> List<ActionLog>) {
        val current = runCatching { prefs.getString(KEY, null)?.let { adapter.fromJson(it) } }.getOrNull() ?: return
        save(current.copy(todayActions = transform(current.todayActions)))
    }

    fun clear() = prefs.edit { remove(KEY) }

    private companion object { const val KEY = "snapshot" }
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/local/TodayCache.kt
git commit -m "feat(offline): TodayCache — кэш экрана «Сегодня» (F1)"
```

---

## Task 6: Android — `ActionSyncManager` (прогон очереди)

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/data/sync/ActionSyncManager.kt`
- Test: `android/app/src/test/java/ru/dachakalend/app/sync/ActionSyncManagerTest.kt`

- [ ] **Step 1: Создать `ActionSyncManager.kt`**

```kotlin
package ru.dachakalend.app.data.sync

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.model.CreateActionRequest
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Прогоняет очередь офлайн-мутаций по порядку (FIFO) при возврате связи / foreground /
 * успешном loadToday. Под Mutex — параллельных прогонов не допускаем (иначе двойная отправка).
 */
@Singleton
class ActionSyncManager @Inject constructor(
    private val api: DachaApi,
    private val queue: ActionQueue,
) {
    private val mutex = Mutex()

    suspend fun sync() {
        // Уже идёт прогон — выходим (повторно дёрнут следующим триггером).
        if (!mutex.tryLock()) return
        try {
            for (op in queue.load()) {
                val done = try {
                    send(op)
                    true
                } catch (e: HttpException) {
                    // 4xx (вкл. 404 на DELETE) — неретраибельно: снимаем из очереди.
                    // 5xx — транзиентно: стоп, ждём следующего триггера.
                    e.code() in 400..499
                } catch (e: IOException) {
                    false // нет связи — стоп
                }
                if (done) queue.remove(op.clientId) else break
            }
        } finally {
            mutex.unlock()
        }
    }

    private suspend fun send(op: QueuedOp) {
        when (op.op) {
            "LOG" -> api.createAction(
                CreateActionRequest(
                    plantingId = op.plantingId,
                    type = op.type ?: "other",
                    notes = op.notes,
                    auto = op.auto,
                    clientId = op.clientId,
                    loggedAt = op.loggedAt,
                )
            )
            "STAGE" -> api.updatePlantingStage(op.plantingId, mapOf("stage" to (op.stage ?: "transplanted")))
            "DELETE" -> op.targetServerId?.let { api.deleteAction(it) }
        }
    }
}
```

- [ ] **Step 2: Написать падающие тесты**

Создать `android/app/src/test/java/ru/dachakalend/app/sync/ActionSyncManagerTest.kt`:

```kotlin
package ru.dachakalend.app.sync

import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.sync.ActionSyncManager
import java.io.IOException

class ActionSyncManagerTest {

    private fun http(code: Int) = HttpException(Response.error<Any>(code, "".toResponseBody(null)))
    private fun logOp(id: String) = QueuedOp(clientId = id, op = "LOG", plantingId = 1, type = "watering")
    private val sentAction = ActionLog(1, 1, null, "watering", null, false, "2026-06-20T00:00:00Z")

    @Test
    fun `успешная отправка снимает операцию из очереди`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } returns sentAction

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("a") }
    }

    @Test
    fun `сетевая ошибка останавливает прогон и НЕ снимает операцию`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"), logOp("b"))
        coEvery { api.createAction(any()) } throws IOException("offline")

        ActionSyncManager(api, queue).sync()

        verify(exactly = 0) { queue.remove(any()) }
    }

    @Test
    fun `4xx снимает операцию (неретраибельно)`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } throws http(403)

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("a") }
    }

    @Test
    fun `5xx оставляет операцию в очереди`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } throws http(500)

        ActionSyncManager(api, queue).sync()

        verify(exactly = 0) { queue.remove("a") }
    }

    @Test
    fun `DELETE 404 трактуется как успех`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(QueuedOp(clientId = "d", op = "DELETE", plantingId = 1, targetServerId = 7))
        coEvery { api.deleteAction(7) } throws http(404)

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("d") }
    }
}
```

- [ ] **Step 3: Запустить тесты — убедиться, что падают**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.sync.ActionSyncManagerTest"`
Expected: FAIL (если бы класса не было — но он из Step 1 уже есть; тесты должны пройти. Если Step 1 пропущен — компиляция падает). Если все зелёные сразу — ок, переходим к Step 4.

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.sync.ActionSyncManagerTest"`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/sync/ActionSyncManager.kt android/app/src/test/java/ru/dachakalend/app/sync/ActionSyncManagerTest.kt
git commit -m "feat(offline): ActionSyncManager — прогон очереди под Mutex (F1)"
```

---

## Task 7: Android — `ActionsRepository`: enqueue при офлайне + оптимизм

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/repository/ActionsRepository.kt`
- Test: `android/app/src/test/java/ru/dachakalend/app/actions/ActionsRepositoryTest.kt`

- [ ] **Step 1: Переписать `ActionsRepository`**

```kotlin
package ru.dachakalend.app.data.repository

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.local.TodayCache
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CreateActionRequest
import java.io.IOException
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.absoluteValue

/** Действие, записанное (в т.ч. оптимистично) — для локального закрытия задачи на «Сегодня». */
data class LoggedActionInfo(val plantingId: Int, val type: String)

@Singleton
class ActionsRepository @Inject constructor(
    private val api: DachaApi,
    private val queue: ActionQueue,
    private val todayCache: TodayCache,
) {

    private val _deletedActionId = MutableSharedFlow<Int>()
    val deletedActionEvents: SharedFlow<Int> = _deletedActionId.asSharedFlow()

    private val _loggedAction = MutableSharedFlow<LoggedActionInfo>()
    val loggedActionEvents: SharedFlow<LoggedActionInfo> = _loggedAction.asSharedFlow()

    suspend fun getActions(plantingId: Int? = null): Result<List<ActionLog>> = try {
        Result.Success(api.getActions(plantingId = plantingId))
    } catch (e: Exception) {
        errorResult(e, "Ошибка загрузки действий")
    }

    suspend fun logAction(plantingId: Int, type: String, notes: String? = null, auto: Boolean = false): Result<ActionLog> {
        val clientId = UUID.randomUUID().toString()
        val loggedAt = Instant.now().toString()
        return try {
            val saved = api.createAction(CreateActionRequest(plantingId, type, notes, auto, clientId, loggedAt))
            _loggedAction.emit(LoggedActionInfo(plantingId, type))
            Result.Success(saved)
        } catch (e: IOException) {
            // Офлайн: ставим в очередь, оптимистично возвращаем синтетическое действие.
            queue.enqueue(QueuedOp(
                clientId = clientId, op = "LOG", plantingId = plantingId,
                type = type, notes = notes, auto = auto, loggedAt = loggedAt,
                createdAt = System.currentTimeMillis(),
            ))
            val optimistic = ActionLog(
                id = -(clientId.hashCode().absoluteValue.coerceAtLeast(1)),
                plantingId = plantingId, cropName = null, type = type,
                notes = notes, auto = auto, loggedAt = loggedAt,
                clientId = clientId, pending = true,
            )
            // Показать сразу в ленте «Сделано сегодня» (если есть кэш).
            todayCache.updateActions { listOf(optimistic) + it }
            _loggedAction.emit(LoggedActionInfo(plantingId, type))
            Result.Success(optimistic)
        } catch (e: Exception) {
            errorResult(e, "Ошибка записи действия")
        }
    }

    /**
     * Смена стадии посадки (напр. «Высадка» → transplanted). Офлайн → ставим STAGE в очередь
     * и оптимистично считаем успешной. Идемпотентна (set-стадия), конфликтов нет.
     */
    suspend fun changeStage(plantingId: Int, stage: String): Result<Unit> = try {
        api.updatePlantingStage(plantingId, mapOf("stage" to stage))
        Result.Success(Unit)
    } catch (e: IOException) {
        queue.enqueue(QueuedOp(
            clientId = UUID.randomUUID().toString(), op = "STAGE",
            plantingId = plantingId, stage = stage, createdAt = System.currentTimeMillis(),
        ))
        Result.Success(Unit)
    } catch (e: Exception) {
        errorResult(e, "Ошибка смены стадии")
    }

    /**
     * Удаление действия. Если действие ещё не синхронизировано (clientId в очереди) — просто
     * убираем операцию из очереди и из кэш-ленты, на сервер не идём. Иначе пытаемся удалить;
     * офлайн → ставим DELETE в очередь (оптимистично считаем удалённым).
     */
    suspend fun deleteAction(id: Int, clientId: String? = null): Result<Unit> {
        if (clientId != null && queue.removeByTargetClientId(clientId)) {
            todayCache.updateActions { actions -> actions.filterNot { it.clientId == clientId } }
            _deletedActionId.emit(id)
            return Result.Success(Unit)
        }
        return try {
            api.deleteAction(id)
            _deletedActionId.emit(id)
            Result.Success(Unit)
        } catch (e: IOException) {
            queue.enqueue(QueuedOp(
                clientId = UUID.randomUUID().toString(), op = "DELETE",
                plantingId = 0, targetServerId = id, createdAt = System.currentTimeMillis(),
            ))
            todayCache.updateActions { actions -> actions.filterNot { it.id == id } }
            _deletedActionId.emit(id)
            Result.Success(Unit)
        } catch (e: Exception) {
            errorResult(e, "Ошибка удаления")
        }
    }
}
```

- [ ] **Step 2: Написать падающие тесты**

Создать `android/app/src/test/java/ru/dachakalend/app/actions/ActionsRepositoryTest.kt`:

```kotlin
package ru.dachakalend.app.actions

import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.local.TodayCache
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.Result
import java.io.IOException

class ActionsRepositoryTest {

    private val saved = ActionLog(5, 1, null, "watering", null, false, "2026-06-20T00:00:00Z")

    @Test
    fun `онлайн-лог отправляет на сервер и НЕ ставит в очередь`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { api.createAction(any()) } returns saved

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.logAction(1, "watering")

        assertTrue(res is Result.Success)
        assertEquals(5, (res as Result.Success).data.id)
        verify(exactly = 0) { queue.enqueue(any()) }
    }

    @Test
    fun `офлайн-лог ставит в очередь и возвращает pending-действие`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { api.createAction(any()) } throws IOException("offline")

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.logAction(1, "watering")

        assertTrue(res is Result.Success)
        val action = (res as Result.Success).data
        assertTrue(action.pending)
        assertTrue(action.id < 0)
        val opSlot = slot<QueuedOp>()
        verify { queue.enqueue(capture(opSlot)) }
        assertEquals("LOG", opSlot.captured.op)
        assertEquals(action.clientId, opSlot.captured.clientId)
    }

    @Test
    fun `удаление ещё не синхронизированного действия убирает его из очереди без сервера`() = runTest {
        val api = mockk<DachaApi>(relaxed = true)
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { queue.removeByTargetClientId("c1") } returns true

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.deleteAction(-7, clientId = "c1")

        assertTrue(res is Result.Success)
        io.mockk.coVerify(exactly = 0) { api.deleteAction(any()) }
    }
}
```

- [ ] **Step 3: Запустить тесты — убедиться, что проходят**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.actions.ActionsRepositoryTest"`
Expected: PASS (3 теста).

- [ ] **Step 4: Проверить компиляцию (DI: новые зависимости конструктора)**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL (Hilt сам предоставит `ActionQueue`/`TodayCache` — они `@Singleton` с `@Inject` конструктором).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/repository/ActionsRepository.kt android/app/src/test/java/ru/dachakalend/app/actions/ActionsRepositoryTest.kt
git commit -m "feat(offline): ActionsRepository — enqueue при офлайне + оптимизм (F1)"
```

---

## Task 7b: Android — офлайн-«Высадка» в `ActionLogViewModel`

`logTransplanting`/`logTransplantingMulti` сейчас зовут `plantingsRepository.updateStage`, который офлайн отдаёт ошибку. Переводим смену стадии на `actionsRepository.changeStage` (Task 7) — она ставит `STAGE` в очередь. Сам action-лог уже офлайн-устойчив (`actionsRepository.logAction`).

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/actions/ActionLogViewModel.kt:108-151`

- [ ] **Step 1: Перевести стадию на `changeStage`**

В `ActionLogViewModel.kt` заменить тела `logTransplanting` и `logTransplantingMulti`:

```kotlin
    /** Логирует "Высаживание" и переводит стадию в transplanted. Офлайн-устойчиво (очередь). */
    fun logTransplanting(plantingId: Int) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            actionsRepository.logAction(plantingId, "transplanting", null)
            when (val result = actionsRepository.changeStage(plantingId, "transplanted")) {
                is Result.Success -> _uiState.value = ActionLogUiState(success = true)
                is Result.Error   -> _uiState.value = ActionLogUiState(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Мульти-посадочная «Высадка»: фиксирует действие и переводит каждую посадку в transplanted. */
    fun logTransplantingMulti(plantingIds: List<Int>) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            for (id in plantingIds) {
                actionsRepository.logAction(id, "transplanting", null)
                val result = actionsRepository.changeStage(id, "transplanted")
                if (result is Result.Error) {
                    _uiState.value = ActionLogUiState(error = result.message)
                    return@launch
                }
            }
            _uiState.value = ActionLogUiState(success = true)
        }
    }
```

`plantingsRepository` остаётся в конструкторе VM (используется в других местах) — если после правки он больше нигде не нужен в этом классе, удалить из конструктора и импорты. Проверить `grep "plantingsRepository" ActionLogViewModel.kt`.

- [ ] **Step 2: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Прогнать существующий `ActionLogViewModelTest` (регрессия)**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.actions.ActionLogViewModelTest"`
Expected: PASS. Если тест мокал `plantingsRepository.updateStage` для transplanting — перенацелить на `actionsRepository.changeStage` (`coEvery { actionsRepo.changeStage(any(), "transplanted") } returns Result.Success(Unit)`).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/actions/ActionLogViewModel.kt android/app/src/test/java/ru/dachakalend/app/actions/ActionLogViewModelTest.kt
git commit -m "feat(offline): офлайн-«Высадка» через changeStage-очередь (F1)"
```

---

## Task 8: Android — `TodayViewModel`: кэш, офлайн-флаг, оптимистичное закрытие

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayViewModel.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt` (перенести `taskSnoozeKey`/`recKey`)
- Test: `android/app/src/test/java/ru/dachakalend/app/today/TodayViewModelTest.kt`

- [ ] **Step 1: Перенести ключи задач/советов в `TodayViewModel.kt`**

В `TodayScreen.kt` удалить приватные определения (строка ~155-156):

```kotlin
private fun recKey(rec: Recommendation) = "${rec.type}:${rec.cropName}:${rec.message.take(30)}"
private fun taskSnoozeKey(task: TodayTask) = "${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"
```

И добавить их (как internal top-level) в конец `TodayViewModel.kt`, импортировав модели:

```kotlin
import ru.dachakalend.app.data.model.TodayTask
// (Recommendation уже импортирован)

internal fun recKey(rec: Recommendation) = "${rec.type}:${rec.cropName}:${rec.message.take(30)}"
internal fun taskSnoozeKey(task: TodayTask) = "${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"
```

(в `TodayScreen.kt` они теперь видны — тот же пакет `ru.dachakalend.app.ui.today`.)

- [ ] **Step 2: Расширить `TodayScreenData` и конструктор VM**

В `TodayViewModel.kt` заменить `data class TodayScreenData` на:

```kotlin
data class TodayScreenData(
    val today: TodayResponse,
    val recommendations: List<Recommendation>,
    val plantings: List<Planting> = emptyList(),
    val todayActions: List<ActionLog> = emptyList(),
    // F1: данные показаны из кэша (нет сети), cachedAt — когда снят снимок.
    val offline: Boolean = false,
    val cachedAt: Long? = null,
)
```

В конструкторе VM добавить зависимости (после `api: DachaApi`):

```kotlin
    private val api: DachaApi,
    private val todayCache: ru.dachakalend.app.data.local.TodayCache,
    private val syncManager: ru.dachakalend.app.data.sync.ActionSyncManager,
```

- [ ] **Step 3: Оптимистичное закрытие задачи + синк по logged-событию**

В `init { ... }` добавить (после существующего сбора `deletedActionEvents`):

```kotlin
        viewModelScope.launch {
            actionsRepository.loggedActionEvents.collect { info ->
                // Офлайн нельзя пересчитать задачи на сервере → закрываем подходящую локально
                // (snooze: вернётся завтра / обратимо), затем перечитываем (офлайн — из кэша).
                (_uiState.value as? TodayUiState.Success)?.data?.today?.tasks
                    ?.filter { it.plantingId == info.plantingId }
                    ?.forEach { snoozeTask(taskSnoozeKey(it)) }
                loadToday(silent = true)
            }
        }
```

- [ ] **Step 4: Запись/чтение кэша в `loadToday` + синк**

В `loadToday()` заменить финальный блок `_uiState.value = when (todayResult) { ... }` на:

```kotlin
            val gardenIdForCache = gardenId ?: -1
            _uiState.value = when (todayResult) {
                is Result.Success -> {
                    val data = TodayScreenData(
                        today          = todayResult.data,
                        recommendations = if (recsResult is Result.Success) recsResult.data else emptyList(),
                        plantings      = plantingsList.filter { it.stage != "done" },
                        todayActions   = todayActions,
                    )
                    // Сохраняем снимок для офлайна и пробуем синхронизировать очередь.
                    if (gardenIdForCache != -1) {
                        todayCache.save(ru.dachakalend.app.data.local.CachedToday(
                            gardenId = gardenIdForCache,
                            cachedAt = System.currentTimeMillis(),
                            today = data.today,
                            recommendations = data.recommendations,
                            plantings = data.plantings,
                            todayActions = data.todayActions,
                        ))
                    }
                    launch { syncManager.sync() }
                    TodayUiState.Success(data)
                }
                is Result.Error -> {
                    // Сетевая ошибка + есть кэш для текущего сада → показываем офлайн-снимок.
                    val cached = if (todayResult.isNetwork && gardenIdForCache != -1)
                        todayCache.load(gardenIdForCache) else null
                    if (cached != null) {
                        TodayUiState.Success(TodayScreenData(
                            today = cached.today,
                            recommendations = cached.recommendations,
                            plantings = cached.plantings.filter { it.stage != "done" },
                            todayActions = cached.todayActions,
                            offline = true,
                            cachedAt = cached.cachedAt,
                        ))
                    } else {
                        TodayUiState.Error(todayResult.message)
                    }
                }
                is Result.Loading -> TodayUiState.Loading
            }
```

(нужен импорт `kotlinx.coroutines.launch` — уже есть.)

- [ ] **Step 5: Прокинуть clientId в удаление действия**

В `TodayViewModel.deleteAction` заменить сигнатуру/тело:

```kotlin
    fun deleteAction(id: Int, clientId: String? = null) {
        viewModelScope.launch {
            when (actionsRepository.deleteAction(id, clientId)) {
                is Result.Success -> loadToday(silent = true)
                else -> Unit
            }
        }
    }
```

В `TodayScreen.kt` найти `onDeleteAction = { viewModel.deleteAction(it) }` — это лямбда `(Int) -> Unit` из карточки действия. Заменить вызов рендера ленты так, чтобы передавать `clientId` из `ActionLog`. В месте, где рисуется `todayActions` (компонент с `onDeleteAction`), вызвать `viewModel.deleteAction(action.id, action.clientId)`. Если `onDeleteAction` принимает только `Int` — расширить его до `(ActionLog) -> Unit` в `TodayContent` и прокинуть `action` целиком.

- [ ] **Step 6: Обновить существующий `TodayViewModelTest` (конструктор)**

В `TodayViewModelTest.kt` добавить моки и прокинуть их в `buildViewModel`:

```kotlin
    private lateinit var todayCache: ru.dachakalend.app.data.local.TodayCache
    private lateinit var syncManager: ru.dachakalend.app.data.sync.ActionSyncManager
```

в `setUp()`:

```kotlin
        todayCache = mockk(relaxed = true)
        syncManager = mockk(relaxed = true)
```

и `buildViewModel()`:

```kotlin
    private fun buildViewModel() = TodayViewModel(
        todayRepo, recsRepo, plantingsRepo, gardenRepo, actionsRepo, tokenStorage, api, todayCache, syncManager
    )
```

- [ ] **Step 7: Добавить тесты офлайн-фолбэка**

В `TodayViewModelTest.kt` добавить (импортировать `CachedToday`, `TodayResponse`):

```kotlin
    @Test
    fun `сетевая ошибка с кэшем показывает офлайн-Success`() = runTest {
        coEvery { todayRepo.getToday() }              returns Result.Error("offline", isNetwork = true)
        coEvery { recsRepo.getRecommendations() }     returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) } returns Result.Success(emptyList())
        every { todayCache.load(1) } returns ru.dachakalend.app.data.local.CachedToday(
            gardenId = 1, cachedAt = 123L,
            today = TodayResponse(gardenId = 1), recommendations = emptyList(),
            plantings = emptyList(), todayActions = emptyList(),
        )

        buildViewModel().uiState.test {
            awaitItem() // Loading
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Success
            assertTrue(state.data.offline)
            assertEquals(123L, state.data.cachedAt)
        }
    }

    @Test
    fun `сетевая ошибка без кэша остаётся Error`() = runTest {
        coEvery { todayRepo.getToday() }              returns Result.Error("offline", isNetwork = true)
        coEvery { recsRepo.getRecommendations() }     returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) } returns Result.Success(emptyList())
        every { todayCache.load(any()) } returns null

        buildViewModel().uiState.test {
            awaitItem()
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Error
            assertTrue(state.message.contains("offline"))
        }
    }
```

- [ ] **Step 8: Запустить тесты «Сегодня»**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.today.TodayViewModelTest"`
Expected: PASS (прежние 6 + 2 новых).

- [ ] **Step 9: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 10: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/today/TodayViewModel.kt android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt android/app/src/test/java/ru/dachakalend/app/today/TodayViewModelTest.kt
git commit -m "feat(offline): TodayViewModel — кэш-фолбэк, офлайн-флаг, оптимистичное закрытие (F1)"
```

---

## Task 9: Android — `ConnectivityObserver` + старт в `App`

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/data/sync/ConnectivityObserver.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/App.kt`

- [ ] **Step 1: Создать `ConnectivityObserver.kt`**

```kotlin
package ru.dachakalend.app.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Слушает возврат связи и прогоняет очередь офлайн-мутаций (F1). Запускается из App.onCreate.
 * Один app-scoped scope; синхронизация защищена Mutex внутри ActionSyncManager.
 */
@Singleton
class ConnectivityObserver @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val syncManager: ActionSyncManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start() {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch { syncManager.sync() }
            }
        })
    }
}
```

- [ ] **Step 2: Запустить наблюдатель в `App.onCreate`**

В `App.kt` добавить поле и вызов:

```kotlin
    @Inject lateinit var connectivityObserver: ru.dachakalend.app.data.sync.ConnectivityObserver
```

и в конце `onCreate()` (после `Ads.init(this)`):

```kotlin
        connectivityObserver.start()
```

- [ ] **Step 3: Проверить компиляцию всех флейворов**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin :app:compileRustoreDebugKotlin`
Expected: BUILD SUCCESSFUL (оба).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/sync/ConnectivityObserver.kt android/app/src/main/java/ru/dachakalend/app/App.kt
git commit -m "feat(offline): ConnectivityObserver — синк очереди при возврате связи (F1)"
```

---

## Task 10: Android — UI: баннер офлайна, индикатор очереди, пометка pending

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt`

- [ ] **Step 1: Подписаться на размер очереди и показать баннер**

В `@Composable TodayScreen(...)` рядом с другими `collectAsState` добавить (получив `ActionQueue` через VM — см. Step 2):

```kotlin
    val queueSize by viewModel.queueSize.collectAsState()
```

В блоке `is TodayUiState.Success` перед `TodayContent(...)` (внутри колонки контента, в начале) вставить баннер. Если в `TodayContent` нет места под шапкой — добавить параметры `offline: Boolean`, `cachedAt: Long?`, `queueSize: Int` в `TodayContent` и нарисовать карточку-баннер в начале списка:

```kotlin
                if (state.data.offline || queueSize > 0) {
                    OfflineBanner(offline = state.data.offline, cachedAt = state.data.cachedAt, queueSize = queueSize)
                }
```

Добавить компонент в `TodayScreen.kt`:

```kotlin
@Composable
private fun OfflineBanner(offline: Boolean, cachedAt: Long?, queueSize: Int) {
    val text = when {
        offline && cachedAt != null -> {
            val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                .format(java.util.Date(cachedAt))
            if (queueSize > 0) "Нет связи · данные от $time · $queueSize в очереди"
            else "Нет связи · данные от $time"
        }
        offline -> "Нет связи · показаны сохранённые данные"
        else    -> "$queueSize ${plural(queueSize, "действие", "действия", "действий")} ждут отправки"
    }
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(12.dp)) {
            Icon(Icons.Default.CloudOff, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun plural(n: Int, one: String, few: String, many: String): String {
    val mod10 = n % 10; val mod100 = n % 100
    return when {
        mod10 == 1 && mod100 != 11 -> one
        mod10 in 2..4 && mod100 !in 12..14 -> few
        else -> many
    }
}
```

(добавить недостающие импорты: `androidx.compose.material.icons.filled.CloudOff`, `Surface`, `Row`, `Icon`, `Spacer`, `Alignment`, `width` — если их ещё нет в файле.)

- [ ] **Step 2: Пробросить `queueSize` через `TodayViewModel`**

В `TodayViewModel.kt` добавить зависимость `actionQueue` и проксирующий StateFlow:

```kotlin
    private val actionQueue: ru.dachakalend.app.data.local.ActionQueue,
```

(добавить в конструктор) и свойство:

```kotlin
    val queueSize: kotlinx.coroutines.flow.StateFlow<Int> = actionQueue.size
```

Обновить моки конструктора в `TodayViewModelTest.kt` (добавить `actionQueue = mockk(relaxed = true)` с `every { actionQueue.size } returns MutableStateFlow(0)` и прокинуть в `buildViewModel`).

- [ ] **Step 3: Пометка pending в карточке действия**

В рендере ленты `todayActions` (карточка одного `ActionLog`) добавить визуальную пометку для `action.pending`: рядом с временем показать иконку `Icons.Default.Schedule` или текст «↑ ждёт отправки» приглушённым цветом. Найти место, где рисуется строка действия (по `loggedAt`), и добавить:

```kotlin
                if (action.pending) {
                    Text("↑ ждёт отправки",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline)
                }
```

- [ ] **Step 4: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Прогнать весь Android unit-сьют (регрессия конструкторов)**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest`
Expected: PASS (все классы тестов, включая обновлённые конструкторы VM).

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt android/app/src/main/java/ru/dachakalend/app/ui/today/TodayViewModel.kt android/app/src/test/java/ru/dachakalend/app/today/TodayViewModelTest.kt
git commit -m "feat(offline): UI — баннер офлайна, индикатор очереди, пометка pending (F1)"
```

---

## Task 11: Очистка кэша/очереди при logout

Чужие данные не должны показываться/отправляться после смены аккаунта (как с push-токеном).

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/settings/SettingsViewModel.kt` (или место, где реализован logout)

- [ ] **Step 1: Найти logout**

Run: `cd android && grep -rn "fun logout\|clearToken\|deletePushToken" app/src/main/java/ru/dachakalend/app/`
Определить класс/метод, выполняющий выход (ожидаемо `SettingsViewModel.logout()` — см. session-note).

- [ ] **Step 2: Внедрить очистку**

В этот ViewModel добавить зависимости `TodayCache` и `ActionQueue` (Hilt-инъекция в конструктор) и в `logout()` перед/после очистки auth-токена вызвать:

```kotlin
        todayCache.clear()
        actionQueue.clear()
```

- [ ] **Step 3: Проверить компиляцию**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(offline): чистим кэш и очередь при logout (F1)"
```

---

## Task 12: Финальная верификация

- [ ] **Step 1: Бэкенд — полный сьют**

Run: `cd backend && npm test`
Expected: PASS, 330 тестов (327 + 3).

- [ ] **Step 2: Android — unit-сьют + компиляция всех флейворов**

Run: `cd android && ./gradlew :app:testGplayDebugUnitTest :app:compileGplayDebugKotlin :app:compileRustoreDebugKotlin`
Expected: всё BUILD SUCCESSFUL / PASS.

- [ ] **Step 3: Обновить session-note.md и summary.md**

Добавить блок сессии F1: что реализовано (кэш + очередь + бэкенд-идемпотентность), что осталось (деплой миграции 045 на VPS, публикация Android-сборки пользователем, веб вне scope). Отметить, что API уже совместим (старые клиенты без `client_id` работают).

- [ ] **Step 4: Commit**

```bash
git add session-note.md summary.md
git commit -m "docs: F1 офлайн «Сегодня» реализован (Android + backend)"
```

---

## Deploy (отдельной сессией, см. DEPLOY.md)

- **Backend:** `git reset --hard origin/main` на VPS → `npm run migrate` (применит 045) → `pm2 restart`. `npm install` НЕ нужен (зависимости не менялись). Миграция аддитивна и обратно совместима — старые клиенты не ломаются.
- **Android:** собрать/опубликовать (пользователь). Флейворы gplay/rustore/samsung.
- **Веб:** вне scope (полевой сценарий — Android).

---

## Заметки по конвенциям

- Все офлайн-классы (`ActionQueue`, `TodayCache`, `ActionSyncManager`, `ConnectivityObserver`) — `@Singleton` с `@Inject`-конструктором; Hilt предоставит их без правок DI-модулей (`Moshi`/`Context` уже доступны из `NetworkModule`/`@ApplicationContext`).
- Раннер бэкенд-тестов — **vitest** (`npm test`), не jest.
- Сборка Android из CLI на Windows: `JAVA_HOME` → JBR Android Studio (см. session-note / reference_dacha_android_cli_build).
- Тонкие SharedPreferences-обёртки (`ActionQueue`/`TodayCache`) юнит-тестами не покрываются (как `TokenStorage`) — верификация компиляцией; тестируется логика в репозитории/менеджере/VM (mockk).
