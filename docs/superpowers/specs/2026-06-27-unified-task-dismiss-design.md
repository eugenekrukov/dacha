# Единое состояние «отложено/удалено» для задач дня (Android + Web)

## Проблема

Задачи дня (`watering_due`, `harvest_due`, `care_task_due`, `transplant_due`, `frost_alert`,
`reminder`) — не строки в БД, а результат чистой функции `buildTasks()` (`backend/src/utils/todayLogic.js`)
от состояния посадок/погоды/действий на момент запроса. Снуз и удаление карточки сейчас реализованы
**только на Android**, и **только локально**:

- `TokenStorage.kt`: `snoozeTask`/`getSnoozedTasksForToday` (хранится с датой, само сгорает на следующий
  день) и `deleteTask`/`getDeletedTasks` (хранится как `Set<String>` **без даты экспирации** — скрыто
  навсегда на этом устройстве).
- Фильтрация — на клиенте, в `TodayScreen.kt:142-145`: `tasks.filterNot { taskSnoozeKey(it) in snoozedTasks || in deletedTasks }`.

Веб (`web/src/screens/TodayScreen.tsx`) не имеет такого UI вообще — у задач дня нет крестика/свайпа,
только у «советов дня» (`Recommendation`, отдельный механизм через `localStorage`, не трогаем).

Итог: пользователь отложил/удалил карточку в приложении → она пропала там, но осталась на вебе. Баг-репорт
именно так и звучал.

## Цель

Единое, серверное состояние «отложено/удалено» для задач дня, видимое одинаково на Android и Web,
без рассинхрона между платформами и без бессрочного зомби-удаления.

## Архитектура

### 1. Таблица `today_task_dismissals` (миграция `054_today_task_dismissals.sql`)

```sql
CREATE TABLE today_task_dismissals (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    VARCHAR(150) NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('snooze','delete')),
  target_date DATE NOT NULL,
  client_id   VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, task_key)
);
CREATE INDEX today_task_dismissals_lookup ON today_task_dismissals(user_id, target_date);
```

- `task_key` — `"type:plantingId:cropName:careTaskName"` (как нынешний Kotlin `taskSnoozeKey`), кроме
  `reminder` (см. п. 3). Для сгруппированных карточек (`planting_id`/`crop_name` = `null`) ключ —
  `"watering_due:null:null:null"` и т.п.: коллизий нет, т.к. `buildTasks()` формирует не более одной
  сгруппированной карточки на тип в день.
- `target_date`: вычисляется **на сервере**, не доверяем клиенту.
  - `snooze` → `сегодня + 1 день`.
  - `delete` → `сегодня + OVERDUE_WINDOW_DAYS` (21 день — существующая константа `todayLogic.js`,
    которая и так ограничивает срок жизни любой просроченной задачи). Это даёт TTL без точного
    fingerprint-сравнения «база ли изменилась с момента удаления»: к моменту истечения 21 дня сама
    `buildTasks()` уже отбросила бы старую просрочку (`daysOverdue > OVERDUE_WINDOW_DAYS → continue`),
    так что «удалить» технически не может перекрыть подлинно новый цикл задачи дольше, чем она и так
    жила бы без удаления.
- `UNIQUE(user_id, task_key)` + upsert (`ON CONFLICT (user_id, task_key) DO UPDATE`) — повторный свайп
  или офлайн-повтор того же ключа просто перезаписывает `action`/`target_date`. Естественная
  идемпотентность: одинаковый upsert два раза даёт одинаковую строку, отдельная проверка по `client_id`
  не нужна (поле хранится только для трассировки/дебага офлайн-очереди).

### 2. Фильтрация в `GET /today` (`backend/src/routes/today.js`)

Перед `return`: подтянуть `SELECT task_key FROM today_task_dismissals WHERE user_id=$1 AND target_date > CURRENT_DATE`
→ `Set`, отфильтровать `formatTasks()`-результат через общую функцию `taskKey(t)`
(новый экспорт `todayLogic.js`, аналог текущего Kotlin `taskSnoozeKey`). Фильтрация происходит **один раз
на сервере** — оба клиента получают уже урезанный список, синхронизация не нужна.

Побочный эффект: бейдж «требует внимания» (`attentionCount`, `PlantingsViewModel.kt:59`) перестаёт
принимать `snoozed: Set<String>` отдельным параметром — он считается прямо по уже отфильтрованным
сервером данным. Это попутно чинит существующую несогласованность: сейчас `attentionCount` учитывает
только `snoozedTasks`, но не `deletedTasks` — удалённая задача могла зажигать бейдж.

### 3. Напоминания (`type: 'reminder'`) — отдельный путь, без записи в `today_task_dismissals`

У `reminder` уже есть собственная строка в БД (`reminders.id`, `remind_at`, `is_sent`) — отдельная запись
о «скрытии» не нужна, мутируем сам reminder:

- `task_key` для reminder — **`"reminder:<id>"`** (не общая 4-частная схема — у reminder нет
  стабильного `cropName`/`careTaskName`, отличающего разные напоминания по одной культуре).
- `formatTasks()` (`todayLogic.js:433`) сейчас не прокидывает `reminder_id` в выходной объект — нужно
  добавить `reminder_id: t.reminder_id || null`. Без этого клиент не может построить ключ.
- `POST /today/tasks/dismiss` при `task_key.startsWith('reminder:')`:
  - `delete` → `UPDATE reminders SET is_sent=true WHERE id=$1 AND user_id=$2`.
  - `snooze` → `UPDATE reminders SET remind_at = remind_at + interval '1 day' WHERE id=$1 AND user_id=$2`.
  - `WHERE user_id=$2` закрывает IDOR (как в `reminders.js`).
- Это естественно работает с уже существующим окном выборки в `today.js:118`
  (`remind_at BETWEEN NOW() - INTERVAL '1 hour' AND NOW() + INTERVAL '24 hours'` и `r.is_sent=false`):
  после `+1 day` напоминание само выпадает из окна и вернётся через сутки; после `is_sent=true` оно
  исключено условием `is_sent=false` — никакого TTL-хранения не требуется.

### 4. Эндпоинт

```
POST /today/tasks/dismiss
Body: { task_key: string, action: "snooze" | "delete", client_id?: string }
Auth: обязательна
→ 204 No Content
```

Роут: если `task_key` начинается с `reminder:` — путь из п. 3; иначе — upsert в `today_task_dismissals`
с серверным `target_date` из п. 1.

### 5. Android — ключ, очередь, UI

- `taskSnoozeKey()` (`TodayViewModel.kt:260`) меняется:
  ```kotlin
  fun taskSnoozeKey(task: TodayTask) =
      if (task.type == "reminder") "reminder:${task.reminderId}"
      else "${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"
  ```
  (`Models.kt`: `TodayTask` += `reminderId: Int?`).
- `ActionQueue.kt` (`QueuedOp`) — новый вариант операции `"DISMISS_TASK"`, два новых nullable-поля без
  переименования существующих:
  ```kotlin
  data class QueuedOp(
      val clientId: String,
      val op: String,              // + "DISMISS_TASK"
      val plantingId: Int,         // для DISMISS_TASK не используется — кладём -1
      ...
      val taskKey: String? = null,
      val dismissAction: String? = null,  // "snooze" | "delete"
  )
  ```
- `TodayViewModel.snoozeTask(key)`/`deleteTask(key)`:
  1. Оптимистично убирают карточку из текущего `Success`-стейта (локальный `Set<String>` "pending
     hidden", живёт только до следующего успешного `loadToday()` — не персистентное хранилище, в
     отличие от старого `TokenStorage`-подхода).
  2. `ActionQueue.enqueue(QueuedOp(op="DISMISS_TASK", taskKey=key, dismissAction=...))`.
  3. `ActionSyncManager` шлёт `POST /today/tasks/dismiss`; 4xx → снять из очереди (upsert идемпотентен,
     конфликтов по сути не бывает); 5xx/`IOException` → оставить до следующего триггера сети — та же
     схема, что уже работает для `LOG`/`STAGE`/`DELETE` (F1, `2026-06-21-offline-today-design.md`).
- Удаляются как мёртвый код: `TokenStorage.snoozeTask/getSnoozedTasksForToday/deleteTask/getDeletedTasks/
  getSnoozedTasksForCalendar/SnoozedCalendarTask`. Календарь в v1 **не показывает** отложенные задачи на
  их `targetDate` (так же, как сейчас не показывает удалённые) — фича выпадает из скоупа, ценность
  признана недостаточной для отдельного эндпоинта `GET /today/tasks/dismissed`.
- `attentionCount(plantings, pending, snoozed)` (`PlantingsViewModel.kt:59`) теряет параметр `snoozed` —
  считается по уже отфильтрованным сервером данным.

### 6. Web — ключ и UI

- Новая функция `taskKey()` (например, в `web/src/api/schedule.ts`), зеркало Android-версии:
  ```ts
  function taskKey(t: TodayTask): string {
    if (t.type === 'reminder') return `reminder:${t.reminder_id}`
    return `${t.type}:${t.planting_id}:${t.crop_name}:${t.care_task_name}`
  }
  ```
  (`web/src/api/types.ts`: `TodayTask` += `reminder_id: number | null`).
- `api/client.ts` — новый метод `dismissTask(taskKey: string, action: 'snooze' | 'delete')` →
  `POST /today/tasks/dismiss`.
- `TodayScreen.tsx` — у веба нет offline-очереди, прямой вызов с оптимистичным обновлением и откатом
  через перезагрузку при ошибке:
  ```ts
  const dismissTask = (t: TodayTask, action: 'snooze' | 'delete') => {
    setToday(prev => prev && { ...prev, tasks: prev.tasks.filter(x => x !== t) })
    api.dismissTask(taskKey(t), action).catch(() => load())
  }
  ```
- `TaskCard` — две иконки в правом верхнем углу карточки (рядом с бейджем «N дн.»), стилистика как у
  крестика «советов дня»: `Clock` (отложить, title="На завтра") и `X` (удалить, title="Удалить").
  Видимы всегда (не по hover) — для паритета с тач-устройствами, без воссоздания swipe-жеста.
- Существующий `dismiss()`/`loadDismissed()` для `Recommendation` (через `localStorage`) — не трогаем,
  это отдельный механизм (советы дня, не задачи дня).

## Вне скоупа v1

- Календарь не показывает отложенные задачи на их `targetDate` (см. п. 5).
- Миграция существующих локальных записей Android (`SharedPreferences`) на сервер — не делаем: снуз и
  так был однодневным и самосгорал, а постоянных `deleted_tasks` у реальных пользователей — редкий
  эдж-кейс; после обновления такая задача один раз снова появится — приемлемо.
- Очистка устаревших строк `today_task_dismissals` (где `target_date` давно в прошлом) — таблица растёт
  медленно (одна строка на активную задачу на пользователя), индекс по `(user_id, target_date)` делает
  выборку дешёвой даже без чистки; можно добавить периодическую очистку позже при необходимости.

## Затронутые файлы

**Backend:** `backend/src/db/migrations/054_today_task_dismissals.sql` (новый),
`backend/src/utils/todayLogic.js` (`taskKey()` экспорт, `formatTasks` += `reminder_id`),
`backend/src/routes/today.js` (фильтрация по дисмиссалам),
`backend/src/routes/today.js` или новый `backend/src/routes/todayTasks.js` (роут `POST /today/tasks/dismiss`).

**Android:** `TokenStorage.kt` (удаление снуз/делит-методов), `ActionQueue.kt` (`QueuedOp` += поля),
`TodayViewModel.kt` (`taskSnoozeKey`, `snoozeTask`/`deleteTask`, `attentionCount`-вызов),
`PlantingsViewModel.kt` (`attentionCount` сигнатура), `Models.kt` (`TodayTask` += `reminderId`),
`data/sync/ActionSyncManager.kt` (обработка `DISMISS_TASK`).

**Web:** `web/src/api/types.ts` (`TodayTask` += `reminder_id`), `web/src/api/schedule.ts` (`taskKey()`),
`web/src/api/client.ts` (`dismissTask()`), `web/src/screens/TodayScreen.tsx` (`TaskCard` += иконки).
