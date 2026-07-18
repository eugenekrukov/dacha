-- Migration 058: колонки для независимой Telegram-публикации той же очереди контента.
-- Автопостер: cron-джоб jobs/telegramQueueJob.js публикует «созревшие» посты из vk_post_queue
-- (та же очередь, что и для ВК) в Telegram-канал через Bot API. Статус независим от `status` (ВК),
-- чтобы сбой в одном канале не блокировал и не дублировал публикацию в другом (ни wall.post,
-- ни sendMessage не идемпотентны).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 058_telegram_queue_columns.sql

ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_post_url TEXT;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_error TEXT;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_posted_at TIMESTAMPTZ;

-- Быстрый разбор «созревших» для Telegram (частичный индекс только по ожидающим).
CREATE INDEX IF NOT EXISTS idx_vk_queue_telegram_due ON vk_post_queue(scheduled_at)
  WHERE telegram_status = 'pending';
