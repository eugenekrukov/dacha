-- Migration 067: фактическое начало сезона ухода по участку.
--
-- Календарная таблица зон (SEASON_START_DOY в utils/todayLogic.js) даёт только норму.
-- Реальная дата устойчивого перехода через +5 °C гуляет по годам на три недели
-- (Новосибирск 2021–2026: день 91…112), поэтому храним посчитанную по факту дату.
--
-- season_start_year — за какой год посчитано. Не совпал с текущим → значение протухло,
-- берётся норма по зоне, а джоб погоды пересчитает.
ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS season_start_doy  INTEGER,
  ADD COLUMN IF NOT EXISTS season_start_year INTEGER;

COMMENT ON COLUMN gardens.season_start_doy IS
  'День года устойчивого перехода среднесуточной температуры через +5 °C (начало вегетации), по архиву погоды участка';
COMMENT ON COLUMN gardens.season_start_year IS
  'Год, за который посчитан season_start_doy; иначе значение считается протухшим';
