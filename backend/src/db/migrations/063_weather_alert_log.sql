-- Лог отправленных weather-пушей (frost_alert, heat_alert) для дедупа в рамках одного дня.
-- Без этого weatherJob (крон раз в 3 часа) слал один и тот же алерт заново на каждый прогон,
-- пока держится риск — пуш "возвращался" после того, как пользователь его смахнул.

CREATE TABLE IF NOT EXISTS weather_alert_log (
  id         SERIAL PRIMARY KEY,
  garden_id  INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL,  -- 'frost_alert' | 'heat_alert'
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_alert_log_garden_type
  ON weather_alert_log (garden_id, alert_type, sent_at);
