-- 066_photo_ai_diagnosis.sql
-- F2: AI-диагностика по фото (closed-set, Qwen-VL). Результат кладём прямо на фото —
-- один диагноз на фото, отдельная таблица не нужна (YAGNI, пока нет истории пере-диагнозов).
-- Идемпотентно: IF NOT EXISTS.

ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosis JSONB;
ALTER TABLE planting_photos ADD COLUMN IF NOT EXISTS ai_diagnosed_at TIMESTAMPTZ;

COMMENT ON COLUMN planting_photos.ai_diagnosis IS
  'AI-диагноз на основе фото: {disease: string, confidence: float, recommendation: string, model: string}.';

COMMENT ON COLUMN planting_photos.ai_diagnosed_at IS
  'Время, когда был выполнен AI-диагноз.';
