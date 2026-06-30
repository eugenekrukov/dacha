-- 054_today_task_dismissals.sql
-- Единое серверное состояние «отложено/удалено» для задач дня (Android + Web).
-- Задачи дня — не строки в БД, а результат buildTasks() (utils/todayLogic.js). Снуз/удаление
-- карточки хранилось только локально на Android → рассинхрон с вебом. Эта таблица переносит
-- состояние на сервер: GET /today фильтрует задачи по активным дисмиссалам, оба клиента видят
-- одинаковый урезанный список. Спека: docs/superpowers/specs/2026-06-27-unified-task-dismiss-design.md
--
-- task_key      — "type:plantingId:cropName:careTaskName" (зеркало Kotlin taskSnoozeKey);
--                 сгруппированная карточка → "watering_due:null:null:null" (не более одной на тип в день).
-- target_date   — вычисляется НА СЕРВЕРЕ: snooze → сегодня+1; delete → сегодня+21 (OVERDUE_WINDOW_DAYS).
--                 Фильтр в GET /today: target_date > CURRENT_DATE. По истечении срока buildTasks()
--                 и так отбросила бы просрочку, так что «удалить» не перекрывает подлинно новый цикл.
-- UNIQUE(user_id, task_key) + upsert (ON CONFLICT DO UPDATE) — естественная идемпотентность повторного
--                 свайпа/офлайн-повтора; client_id хранится только для трассировки офлайн-очереди.

CREATE TABLE IF NOT EXISTS today_task_dismissals (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    VARCHAR(150) NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('snooze', 'delete')),
  target_date DATE NOT NULL,
  client_id   VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, task_key)
);

CREATE INDEX IF NOT EXISTS today_task_dismissals_lookup
  ON today_task_dismissals(user_id, target_date);
