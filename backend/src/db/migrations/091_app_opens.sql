-- Migration 091: открытия приложения — основа метрики удержания (D1/D7/D30).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 091_app_opens.sql
--
-- ПРИЧИНА: docs/strategy-2026-09.md, п. 1.2. До этой миграции удержание считалось только по
-- записям в БД (действия/посадки) — человек, который открыл «Сегодня» и закрыл, был невидим.
--
-- Одна строка на устройство в день (UNIQUE device_id+opened_on) — DAU-зерно: хватает для
-- D1/D7/D30, таблица не пухнет от каждого сворачивания приложения. user_id — nullable:
-- открытие до регистрации (и будущий гостевой режим) тоже считается. Дата — по Москве.
-- Когорта устройства = install_events.created_at (есть с июля), иначе первая строка здесь.

CREATE TABLE IF NOT EXISTS app_opens (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  opened_on   DATE NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  store       TEXT,
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, opened_on)
);

CREATE INDEX IF NOT EXISTS app_opens_user_id_idx ON app_opens (user_id);

-- Таблицу создаёт postgres — отдаём владение бэкенду (грабли 055: иначе permission denied).
ALTER TABLE app_opens OWNER TO dacha_user;
