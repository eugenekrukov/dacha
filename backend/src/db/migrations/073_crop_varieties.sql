-- 073_crop_varieties.sql
-- Сорта культур. Пилот на 3 культурах (томат/огурец/картофель) руками; заливка
-- ~500 сортов из Госреестра — отдельным контент-конвейером (docs/superpowers/plans/
-- 2026-08-17-crop-varieties.md).

CREATE TABLE IF NOT EXISTS crop_varieties (
  id                SERIAL PRIMARY KEY,
  crop_id           INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  name              VARCHAR(120) NOT NULL,
  slug              TEXT UNIQUE,          -- для будущих SEO-страниц
  ripening          VARCHAR(20),          -- early|mid|late (овощи) / summer|autumn|winter (плодовые)
  harvest_days      INTEGER,              -- перекрывает crops.harvest_days; NULL = данных нет
  harvest_doy_start SMALLINT,             -- для многолетних/плодовых: окно съёма, день года
  harvest_doy_end   SMALLINT,
  transplant_days   INTEGER,              -- NULL = как у культуры
  is_hybrid         BOOLEAN DEFAULT false,-- F1
  conditions        VARCHAR(20),          -- soil|greenhouse|any
  regions           SMALLINT[],           -- коды регионов допуска Госреестра 1..12
  gossort_number    VARCHAR(20),
  year_registered   SMALLINT,
  notes             TEXT,
  source            TEXT NOT NULL,        -- откуда взяты сроки; без источника строку не заливаем
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (crop_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crop_varieties_crop ON crop_varieties(crop_id);

-- Права рантайм-пользователю (см. 055/060 — таблицу создаёт суперюзер, старые GRANT её не покрывают).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dacha_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE crop_varieties TO dacha_user;
    GRANT USAGE, SELECT ON SEQUENCE crop_varieties_id_seq TO dacha_user;
  END IF;
END $$;
