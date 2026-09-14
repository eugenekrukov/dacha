-- Migration 090: пользовательский токен ВК через VK ID (access + refresh) для загрузки фото автопостером.
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 090_vk_auth.sql
--
-- ПРИЧИНА: ключ сообщества не умеет photos.getWallUploadServer (ошибка 27, см. vkQueueJob.js), а
-- пользовательские токены с offline больше не выдают (ответ devsupport ВК, 12.09.2026). VK ID даёт
-- access token на 1 час + refresh token на 180 дней; при каждом обмене refresh ротируется, старая пара
-- перестаёт работать — поэтому пара живёт в БД, а не в .env.
--
-- Одна строка (id=1), тот же паттерн, что nalog_auth (040). Заполняется scripts/vk-id-auth.js.
CREATE TABLE IF NOT EXISTS vk_auth (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  access_token  TEXT,
  refresh_token TEXT,
  device_id     TEXT,
  expires_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT vk_auth_single_row CHECK (id = 1)
);
INSERT INTO vk_auth (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE vk_auth OWNER TO dacha_user;
