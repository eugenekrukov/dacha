-- Сохраняем название населённого пункта для переиспользования при геокодинге
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS city VARCHAR(100);
