-- 078_crops_harvest_doy.sql
-- Окно сбора урожая для многолетников (ягодные кусты, плодовые деревья) — у них
-- «110 дней от посадки» бессмысленно (crops.harvest_days для этих культур NULL,
-- см. 002/006/037), урожай приходит в календарное окно каждый год.
-- Значения — день года (1 = 1 января), заданы для зоны 5 (средняя полоса, эталон уже
-- используется для SEASON_START_DOY в utils/todayLogic.js); сдвиг под зону участка
-- считает effectiveHarvestWindow/nextHarvestWindowDate тем же дельта-методом, что и
-- начало сезона (см. план docs/superpowers/plans/2026-08-17-crop-varieties.md, раздел «Риски»).

ALTER TABLE crops ADD COLUMN IF NOT EXISTS harvest_doy_start SMALLINT;
ALTER TABLE crops ADD COLUMN IF NOT EXISTS harvest_doy_end SMALLINT;
