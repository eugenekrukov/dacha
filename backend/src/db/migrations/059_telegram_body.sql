-- Migration 059: отдельный текст поста для Telegram (короткий формат — эмодзи, абзацы,
-- без markdown-заголовков), в отличие от лонгрида `body`, который уходит в ВК/Дзен.
-- Если для поста telegram-версия не подготовлена — telegram_body остаётся NULL, и
-- telegramQueueJob.js публикует в канал общий `body`, как и раньше (обратная совместимость).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 059_telegram_body.sql

ALTER TABLE vk_post_queue ADD COLUMN IF NOT EXISTS telegram_body TEXT;
