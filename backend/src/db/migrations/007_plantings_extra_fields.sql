-- 007: Add quantity and conditions to plantings
ALTER TABLE plantings
  ADD COLUMN IF NOT EXISTS quantity     INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conditions   VARCHAR(20) NOT NULL DEFAULT 'soil';

-- conditions: 'soil' | 'greenhouse'
