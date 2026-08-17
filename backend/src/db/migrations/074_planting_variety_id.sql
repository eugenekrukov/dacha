-- 074_planting_variety_id.sql
-- Ссылка посадки на сорт из справочника. plantings.variety (свободный текст, 046) не трогаем —
-- сорт из коробки семян может отсутствовать в Госреестре, запрещать его ввод было бы регрессом.
-- При выборе сорта из списка бэкенд пишет оба поля: variety_id + variety = имя сорта.

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS variety_id INTEGER REFERENCES crop_varieties(id);
