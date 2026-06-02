-- Расширение weather_snapshots: вероятность осадков, температура почвы, 7-дневный прогноз
ALTER TABLE weather_snapshots
  ADD COLUMN IF NOT EXISTS precip_prob_pct  INTEGER,
  ADD COLUMN IF NOT EXISTS soil_temp_c      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS forecast_json    JSONB;
