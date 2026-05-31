-- Лог отправленных push-уведомлений об уходе (watering_due, fertilizing_due)
-- Используется для предотвращения дублирующих пушей в рамках одного дня.

CREATE TABLE IF NOT EXISTS care_alert_log (
  id          SERIAL PRIMARY KEY,
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  alert_type  VARCHAR(30) NOT NULL,  -- 'watering_due' | 'fertilizing_due'
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для быстрой проверки "отправляли ли сегодня"
CREATE INDEX IF NOT EXISTS idx_care_alert_log_planting_type_date
  ON care_alert_log (planting_id, alert_type, (sent_at::date));
