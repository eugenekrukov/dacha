-- Migration 084: pg_trgm — нечёткое сравнение строк для сортов культур.
-- Нужен, чтобы при ручном вводе сорта опечатки («Бычье серце») автоматически
-- сопоставлялись с уже существующей записью справочника («Бычье сердце»), а не
-- плодили дубли. См. resolveVarietyId в routes/plantings.js.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_crop_varieties_name_trgm
  ON crop_varieties USING gin (name gin_trgm_ops);
