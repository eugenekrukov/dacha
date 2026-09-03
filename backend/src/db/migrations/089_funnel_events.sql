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
