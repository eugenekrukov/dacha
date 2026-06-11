-- Migration 026: провайдер push-токена (мультипровайдерные пуши, E5)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 026_push_provider.sql
--
-- provider определяет, как доставлять пуш:
--   'rustore' — через RuStore Push (vkpns), для устройств с RuStore (флейвор rustore);
--   'fcm'     — напрямую через Firebase Cloud Messaging, для устройств с Google (gplay/samsung).
-- Существующие токены — 'rustore' (грандфатеринг). Колонка наследует владельца таблицы push_tokens.
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'rustore';
