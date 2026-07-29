-- 060_seeds.sql
-- Инвентарь семян: коробка с пакетиками, которую дачник не помнит наизусть.
-- Культура — свободный текст, а не FK на crops: в справочнике 55 культур (овощи, зелень,
-- ягоды, кусты), а в коробке лежат ещё и цветы («Бархатцы»), которых там нет.
-- Срок годности хранится датой; месячная точность с пакетика («годен до 12.2027»)
-- нормализуется в последний день месяца на бэкенде.

CREATE TABLE IF NOT EXISTS seeds (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_name  TEXT NOT NULL,
  variety    VARCHAR(120),
  expires_on DATE,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seeds_user_id ON seeds(user_id);

-- Права рантайм-пользователю: таблицу создаёт суперюзер, старые GRANT её не покрывают
-- (см. 055 — там на этом уже обожглись с garden_beds). Guard на случай локальной БД без роли.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dacha_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE seeds TO dacha_user;
    GRANT USAGE, SELECT ON SEQUENCE seeds_id_seq TO dacha_user;
  END IF;
END $$;
