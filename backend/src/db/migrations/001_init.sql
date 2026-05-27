-- Migration 001: Initial schema for Dacha Calendar MVP
-- Run: psql -U dacha_user -d dacha_db -f 001_init.sql

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  name                  VARCHAR(100),
  push_token            VARCHAR(500),
  notification_settings JSONB DEFAULT '{"watering": true, "frost": true, "harvest": true}'::jsonb,
  subscription_status   VARCHAR(20) DEFAULT 'free',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Gardens (участки)
CREATE TABLE IF NOT EXISTS gardens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL DEFAULT 'Мой участок',
  lat          DECIMAL(9,6) NOT NULL,
  lon          DECIMAL(9,6) NOT NULL,
  region       VARCHAR(100),
  soil_type    VARCHAR(50),   -- loam | sandy | clay | peat | black_earth
  climate_zone VARCHAR(20),   -- 3 | 4 | 5 | 6 (USDA hardiness zones для РФ)
  area_m2      INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Crops (справочник культур)
CREATE TABLE IF NOT EXISTS crops (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(100) NOT NULL,
  category           VARCHAR(50),  -- vegetable | berry | fruit | herb | flower
  sowing_start_day   INTEGER,      -- день года (1-365)
  sowing_end_day     INTEGER,
  transplant_days    INTEGER,      -- дней до пикировки
  harvest_days       INTEGER,      -- дней до сбора урожая
  watering_freq_days INTEGER DEFAULT 3,
  frost_sensitive    BOOLEAN DEFAULT true,
  companion_crops    INTEGER[],    -- id совместимых культур
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Plantings (конкретные посадки на участке)
CREATE TABLE IF NOT EXISTS plantings (
  id          SERIAL PRIMARY KEY,
  garden_id   INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  crop_id     INTEGER NOT NULL REFERENCES crops(id),
  planted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage       VARCHAR(30) DEFAULT 'sowing',
  -- sowing | sprouted | growing | flowering | harvesting | done
  quantity    INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Action logs (журнал действий)
CREATE TABLE IF NOT EXISTS action_logs (
  id          SERIAL PRIMARY KEY,
  planting_id INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  -- watered | fertilized | treated | transplanted | other
  notes       TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders (напоминания)
CREATE TABLE IF NOT EXISTS reminders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planting_id INTEGER REFERENCES plantings(id) ON DELETE CASCADE,
  type        VARCHAR(30),  -- watering | fertilizing | treatment | custom
  message     TEXT,
  remind_at   TIMESTAMPTZ NOT NULL,
  is_sent     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Weather snapshots (кэш погоды)
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id              SERIAL PRIMARY KEY,
  garden_id       INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  temp_c          DECIMAL(5,2),
  min_temp_c      DECIMAL(5,2),
  max_temp_c      DECIMAL(5,2),
  humidity_pct    INTEGER,
  precip_mm       DECIMAL(6,2),
  wind_ms         DECIMAL(5,2),
  condition       VARCHAR(50),   -- clear | cloudy | rain | snow | storm
  condition_text  VARCHAR(200),
  frost_risk      BOOLEAN DEFAULT false,
  heat_risk       BOOLEAN DEFAULT false,
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendations (рекомендации)
CREATE TABLE IF NOT EXISTS recommendations (
  id          SERIAL PRIMARY KEY,
  garden_id   INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  planting_id INTEGER REFERENCES plantings(id) ON DELETE CASCADE,
  type        VARCHAR(30),   -- watering | frost_alert | harvest_ready | fertilizing
  priority    VARCHAR(10),   -- critical | high | medium | low
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Harvests (урожай)
CREATE TABLE IF NOT EXISTS harvests (
  id           SERIAL PRIMARY KEY,
  planting_id  INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  weight_kg    DECIMAL(7,2),
  quantity     INTEGER,
  notes        TEXT,
  harvested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_gardens_user_id ON gardens(user_id);
CREATE INDEX IF NOT EXISTS idx_plantings_garden_id ON plantings(garden_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_planting_id ON action_logs(planting_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_logged_at ON action_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_garden_id ON weather_snapshots(garden_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_garden_id ON recommendations(garden_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_remind ON reminders(user_id, remind_at);
