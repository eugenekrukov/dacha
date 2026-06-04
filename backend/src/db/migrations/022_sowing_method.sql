-- 022: Способ посадки на уровне посадки — 'seedling' (через рассаду) | 'direct' (прямой посев в грунт).
-- От него зависит стадия высадки: только рассадные получают напоминание/стадию «Высажено в грунт».
-- Прямой посев растёт в грунте с момента посева (стадия остаётся 'sowing'), урожай считается напрямую.

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS sowing_method VARCHAR(10) NOT NULL DEFAULT 'seedling';

-- Бэкофилл: культуры без рассадного периода (transplant_days IS NULL) сеют сразу в грунт.
UPDATE plantings p SET sowing_method = 'direct'
FROM crops c
WHERE p.crop_id = c.id AND c.transplant_days IS NULL;

-- Убираем рудиментарную стадию 'sprouted' (Взошло) — её ничто не выставляло, из модели исключена.
UPDATE plantings SET stage = 'sowing' WHERE stage = 'sprouted';
