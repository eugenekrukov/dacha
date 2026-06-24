-- Migration 048: очередь отложенных постов в сообщество ВК.
-- Агент-автопостер: заранее наполняешь очередь (CLI scripts/vk-queue.js load <file>),
-- фоновый джоб (jobs/vkQueueJob.js) публикует «созревшие» посты по расписанию.
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 048_vk_post_queue.sql
--   затем: ALTER TABLE vk_post_queue OWNER TO dacha_user;

CREATE TABLE IF NOT EXISTS vk_post_queue (
  id            SERIAL PRIMARY KEY,
  scheduled_at  TIMESTAMPTZ NOT NULL,        -- когда публиковать
  title         TEXT,                        -- заголовок (для Дзена/архива; в ВК не отдельным полем)
  body          TEXT NOT NULL,               -- текст поста для ВК
  tags          TEXT,                        -- строка хэштегов "#дача #огород"
  image_url     TEXT,                        -- обложка: URL или локальный путь (опц.)
  link          TEXT,                        -- ссылка → первым комментарием (опц.)
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | posted | failed
  vk_post_url   TEXT,                        -- ссылка на опубликованный пост
  error         TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at     TIMESTAMPTZ
);

-- Быстрый разбор «созревших» (частичный индекс только по ожидающим).
CREATE INDEX IF NOT EXISTS idx_vk_queue_due ON vk_post_queue(scheduled_at) WHERE status = 'pending';
ALTER TABLE vk_post_queue OWNER TO dacha_user;
