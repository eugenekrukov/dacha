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

### 3. Напоминания (`type: 'reminder'`) — вне скоупа v1

Карточки типа `reminder` не получают контролов снуза/удаления — как и сейчас, у них просто не будет
крестика/свайпа. У `reminder` уже есть собственная строка в БД (`reminders.id`, `remind_at`, `is_sent`),
поэтому это естественное расширение для отдельной будущей задачи (см. «Вне скоупа v1»), не блокирующее
основной фикс.

### 4. Эндпоинт

```
POST /today/tasks/dismiss
Body: { task_key: string, action: "snooze" | "delete" }
Auth: обязательна
→ 204 No Content
```

Один путь — upsert в `today_task_dismissals` с серверным `target_date` из п. 1. Без поддержки
`reminder:`-ключей (см. п. 3).

### 5. Android — ключ и UI (online-only, без офлайн-очереди)

- `taskSnoozeKey()` (`TodayViewModel.kt:260`) не меняется — остаётся
  `"${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"`.
- `TodayViewModel.snoozeTask(key)`/`deleteTask(key)` перестают писать в `TokenStorage` и вызывают новый
  метод API-клиента напрямую (`api.dismissTask(key, action)`), без `ActionQueue`:
  1. Оптимистично убирают карточку из текущего `Success`-стейта (локальный `Set<String>` "pending
     hidden", живёт только до следующего успешного `loadToday()`).
  2. При ошибке сети/сервера — просто перезагрузить (`loadToday()`), как делает веб; карточка вернётся,
     если запрос не дошёл. Поведение симметрично F1: до офлайн-очереди (F1) обычные действия тоже не
     ставились в очередь — снуз/удаление сейчас не интегрируются в `ActionQueue`/`ActionSyncManager`;
     если в будущем понадобится офлайн-поддержка именно для свайпов — отдельная небольшая задача поверх
     уже существующей инфраструктуры F1.
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
    return `${t.type}:${t.planting_id}:${t.crop_name}:${t.care_task_name}`
  }
  ```
- `api/client.ts` — новый метод `dismissTask(taskKey: string, action: 'snooze' | 'delete')` →
  `POST /today/tasks/dismiss`.
- `TodayScreen.tsx` — прямой вызов с оптимистичным обновлением и откатом через перезагрузку при ошибке:
  ```ts
  const dismissTask = (t: TodayTask, action: 'snooze' | 'delete') => {
    setToday(prev => prev && { ...prev, tasks: prev.tasks.filter(x => x !== t) })
    api.dismissTask(taskKey(t), action).catch(() => load())
  }
  ```
- `TaskCard` — две иконки в правом верхнем углу карточки (рядом с бейджем «N дн.»), стилистика как у
  крестика «советов дня»: `Clock` (отложить, title="На завтра") и `X` (удалить, title="Удалить").
  Не показываются для `t.type === 'reminder'` (см. п. 3). Видимы всегда (не по hover) — для паритета
  с тач-устройствами, без воссоздания swipe-жеста.
- Существующий `dismiss()`/`loadDismissed()` для `Recommendation` (через `localStorage`) — не трогаем,
  это отдельный механизм (советы дня, не задачи дня).

## Вне скоупа v1

- Снуз/удаление reminder-карточек (см. п. 3) — отдельная небольшая задача поверх этой же таблицы/эндпоинта
  (или прямой мутации `reminders.is_sent`/`remind_at`), не блокирует основной фикс.
- Офлайн-поддержка свайпов на Android через `ActionQueue`/`ActionSyncManager` (F1) — v1 online-only
  (см. п. 5); расширение тривиально добавить позже на готовую инфраструктуру F1.
- Календарь не показывает отложенные задачи на их `targetDate` (см. п. 5).
- Миграция существующих локальных записей Android (`SharedPreferences`) на сервер — не делаем: снуз и
  так был однодневным и самосгорал, а постоянных `deleted_tasks` у реальных пользователей — редкий
  эдж-кейс; после обновления такая задача один раз снова появится — приемлемо.
- Очистка устаревших строк `today_task_dismissals` (где `target_date` давно в прошлом) — таблица растёт
  медленно (одна строка на активную задачу на пользователя), индекс по `(user_id, target_date)` делает
  выборку дешёвой даже без чистки; можно добавить периодическую очистку позже при необходимости.

## Затронутые файлы

**Backend:** `backend/src/db/migrations/054_today_task_dismissals.sql` (новый),
`backend/src/utils/todayLogic.js` (`taskKey()` экспорт),
`backend/src/routes/today.js` (фильтрация по дисмиссалам + роут `POST /today/tasks/dismiss`).

**Android:** `TokenStorage.kt` (удаление снуз/делит-методов),
`TodayViewModel.kt` (`snoozeTask`/`deleteTask` → прямой вызов API, `attentionCount`-вызов),
`PlantingsViewModel.kt` (`attentionCount` сигнатура), API-клиент (новый метод `dismissTask`).

**Web:** `web/src/api/schedule.ts` (`taskKey()`),
`web/src/api/client.ts` (`dismissTask()`), `web/src/screens/TodayScreen.tsx` (`TaskCard` += иконки).
