-- Migration 005: Extend crops table with rich agronomical data
-- Добавляет: климатические зоны, детали полива, подкормки, болезни, вредители, совместимость

ALTER TABLE crops
  ADD COLUMN IF NOT EXISTS climate_zones       JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS watering_details    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fertilizing_schedule JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS diseases            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pests               JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS good_neighbors      TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bad_neighbors       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS good_predecessors   TEXT[] DEFAULT '{}';

-- Индекс для поиска по JSON (опционально, для будущих фильтров)
CREATE INDEX IF NOT EXISTS idx_crops_climate_zones ON crops USING GIN (climate_zones);

COMMENT ON COLUMN crops.climate_zones IS
  'Сроки посева/высадки по USDA-зонам РФ: ключи "3","4","5","6". '
  'Значения: sow_start, sow_end, transplant_start, transplant_end (день года 1-365).';

COMMENT ON COLUMN crops.watering_details IS
  'Режим полива по стадиям роста: seedling, sprouted, growing, flowering, fruiting. '
  'Поля: freq_days (частота), amount_l_m2 (литров на м²), notes.';

COMMENT ON COLUMN crops.fertilizing_schedule IS
  'Схема подкормок: [{stage, timing, fertilizer_type, product_example, dose, method, notes}]. '
  'fertilizer_type: N|P|K|NPK|Ca|Mg. method: root|foliar.';

COMMENT ON COLUMN crops.diseases IS
  'Типичные болезни: [{name, symptoms, conditions, treatment, prevention}].';

COMMENT ON COLUMN crops.pests IS
  'Типичные вредители: [{name, signs, treatment, prevention}].';

COMMENT ON COLUMN crops.good_neighbors IS
  'Совместимые культуры по имени (для отображения в UI).';

COMMENT ON COLUMN crops.bad_neighbors IS
  'Несовместимые культуры по имени.';

COMMENT ON COLUMN crops.good_predecessors IS
  'Хорошие предшественники (для рекомендаций по севообороту).';
