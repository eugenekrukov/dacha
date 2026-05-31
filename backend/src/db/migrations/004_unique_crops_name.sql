-- Migration 004: Add UNIQUE constraint on crops.name + deduplicate if needed

-- Удаляем дубликаты, оставляя запись с наименьшим id
DELETE FROM crops
WHERE id NOT IN (
  SELECT MIN(id) FROM crops GROUP BY name
);

-- Добавляем уникальный constraint чтобы ON CONFLICT работал в будущем
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crops_name_unique'
  ) THEN
    ALTER TABLE crops ADD CONSTRAINT crops_name_unique UNIQUE (name);
  END IF;
END$$;
