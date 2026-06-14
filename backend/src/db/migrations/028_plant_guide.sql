-- Migration 028: справочник проблем растений (дефициты микроэлементов, болезни, вредители).
-- Отдельная сущность поверх встроенных crops.diseases/pests (миграция 005): даёт просмотр,
-- поиск и кросс-культурный взгляд + поддержку дефицитов микроэлементов, которых раньше не было.
-- Идемпотентна (миграции прогоняются на каждом деплое).

CREATE TABLE IF NOT EXISTS guide_entries (
  id           SERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,          -- 'potassium-deficiency' (для URL/SEO)
  name         TEXT NOT NULL,                 -- 'Недостаток калия'
  kind         TEXT NOT NULL,                 -- 'deficiency' | 'disease' | 'pest'
  element      TEXT,                          -- 'K'|'Ca'|'Mg'|'N'|'P'|'Fe'|'B' (только для deficiency)
  category     TEXT,                          -- 'грибковое'|'насекомое'|'микроэлемент'…
  danger       SMALLINT,                      -- 1..3 для бейджа/сортировки
  description  TEXT,
  symptoms     TEXT,                          -- общие признаки
  conditions   TEXT,                          -- условия развития / причина
  treatment    TEXT,                          -- меры борьбы / коррекция
  prevention   TEXT,
  season       TEXT,                          -- период риска
  image_url    TEXT,
  image_credit TEXT,                          -- атрибуция лицензии
  search_text  TEXT                           -- денормализованное поле для полнотекстового поиска
);

COMMENT ON TABLE guide_entries IS
  'Справочник проблем растений: дефициты микроэлементов, болезни, вредители.';

-- Признаки и фото, СПЕЦИФИЧНЫЕ для пары культура↔проблема
-- (напр. недостаток калия выглядит по-разному у огурца и томата).
CREATE TABLE IF NOT EXISTS crop_guide_entries (
  crop_id      INT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  entry_id     INT NOT NULL REFERENCES guide_entries(id) ON DELETE CASCADE,
  signs        TEXT,
  image_url    TEXT,
  image_credit TEXT,
  PRIMARY KEY (crop_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_search
  ON guide_entries USING GIN (to_tsvector('russian', coalesce(search_text, '')));

CREATE INDEX IF NOT EXISTS idx_crop_guide_entry ON crop_guide_entries (entry_id);
