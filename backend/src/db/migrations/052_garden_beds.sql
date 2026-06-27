-- 052_garden_beds.sql
-- Грядки участка: именованное место (грунт/теплица), к которому можно привязать посадку.
-- Нужно для подсказки севооборота по ботаническому семейству (см. 053).

CREATE TABLE IF NOT EXISTS garden_beds (
  id         SERIAL PRIMARY KEY,
  garden_id  INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'soil' CHECK (type IN ('soil', 'greenhouse')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_plantings_bed_id ON plantings(bed_id);
CREATE INDEX IF NOT EXISTS idx_garden_beds_garden_id ON garden_beds(garden_id);
