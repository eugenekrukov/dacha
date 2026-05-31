-- Migration 004: Add UNIQUE constraint on crops.name + deduplicate if needed

-- Удаляем дубликаты, оставляя запись с наименьшим id
DELETE FROM crops
WHERE id NOT IN (
  SELECT MIN(id) FROM crops GROUP BY name
);

-- Добавляем уникальный constraint чтобы ON CONFLICT работал в будущем
ALTER TABLE crops ADD CONSTRAINT IF NOT EXISTS crops_name_unique UNIQUE (name);
