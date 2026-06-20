-- Migration 044: фото-дневник посадок (F12). UGC-фото, привязка к посадке и опц. к действию.
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 044_planting_photos.sql
--   затем: ALTER TABLE planting_photos OWNER TO dacha_user;

CREATE TABLE IF NOT EXISTS planting_photos (
  id           SERIAL PRIMARY KEY,
  planting_id  INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  action_id    INTEGER REFERENCES action_logs(id) ON DELETE SET NULL,
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caption      TEXT,
  visibility   VARCHAR(10) NOT NULL DEFAULT 'private',
  file_path    TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  bytes        INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planting_photos_timeline ON planting_photos(planting_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_planting_photos_action   ON planting_photos(action_id);
