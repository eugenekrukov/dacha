-- 056_crops_slug.sql
-- Стабильный slug для публичных SEO-страниц /spravochnik/kultury/{slug}/.
-- Заполняется одноразовым скриптом backend/scripts/backfill-crop-slugs.js, НЕ этой
-- миграцией (транслитерация — JS-логика, не переносится в чистый SQL). Миграции
-- перезапускаются на каждом деплое (см. src/db/migrate.js) — ALTER идемпотентен.

ALTER TABLE crops ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
