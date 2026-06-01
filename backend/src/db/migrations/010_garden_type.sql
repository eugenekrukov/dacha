-- Тип участка: soil (открытый грунт), greenhouse (теплица), mixed (смешанный)
ALTER TABLE gardens ADD COLUMN IF NOT EXISTS garden_type VARCHAR(20) DEFAULT 'soil';
