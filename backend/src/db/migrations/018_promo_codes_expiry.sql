-- Срок действия промокодов:
--   duration_days — на сколько дней код выдаёт доступ при активации (NULL = навсегда/lifetime).
--   expires_at    — дедлайн АКТИВАЦИИ кода: после этой даты код погасить нельзя (NULL = бессрочно).
-- Тип 'days' — код на произвольное число дней (duration_days = N). 'month' оставлен для совместимости (=30).

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ;

-- Бэкофилл существующих месячных кодов
UPDATE promo_codes SET duration_days = 30 WHERE type = 'month' AND duration_days IS NULL;

-- Расширяем допустимые типы: добавляем 'days'
ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_type_check;
ALTER TABLE promo_codes ADD  CONSTRAINT promo_codes_type_check CHECK (type IN ('lifetime', 'month', 'days'));
