-- F4 (2.3): фото культур. Колонки под изображение + кредит (лицензия/автор), как у guide_entries.
-- URL хранится абсолютным (https://dacha.studio1008.com/app/media/crops/<slug>.jpg) — отдаётся
-- статикой nginx, как фото справочника. Заполняется отдельным проходом курирования (Wikimedia).
ALTER TABLE crops ADD COLUMN IF NOT EXISTS image_url    TEXT;
ALTER TABLE crops ADD COLUMN IF NOT EXISTS image_credit TEXT;
