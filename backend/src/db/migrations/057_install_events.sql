-- Реальные установки (первый запуск приложения на устройстве), в отличие от счётчика
-- стора (RuStore/GPlay), который включает установки без единого открытия.
CREATE TABLE IF NOT EXISTS install_events (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  store TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
