-- F2: AI-диагностика по фото (closed-set, Qwen-VL). Результат кладём прямо на фото —
-- один диагноз на фото, отдельная таблица не нужна (YAGNI, пока нет истории пере-диагнозов).
-- Идемпотентно: IF NOT EXISTS.

ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosis    JSONB;
ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosed_at  TIMESTAMPTZ;
