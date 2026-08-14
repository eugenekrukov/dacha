-- 071_garden_bed_dimensions.sql
-- Размеры грядки — вторая часть предпосылки для подсказки вместимости (после схемы
-- посадки в 070_crop_spacing.sql). Необязательные: у существующих грядок размеров нет,
-- подсказка вместимости просто не показывается, пока пользователь их не укажет.

ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS width_cm  INTEGER;
ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS length_cm INTEGER;
