-- Migration 092: гостевой режим (стратегия 2026-09, п. 2.1; спека docs/spec-2026-09-guest-and-season-works.md).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 092_guest_users.sql
--
-- Гость — обычная строка users без email/пароля. Все эндпоинты работают как есть; при регистрации
-- (POST /auth/guest/claim) та же строка получает email и пароль — данные никуда не переносятся.
-- guest_device_id — случайный UUID, сгенерированный клиентом: по нему /auth/guest идемпотентен
-- (повторный вызов с того же устройства возвращает того же гостя, в т.ч. после истечения JWT).
-- UNIQUE на email не мешает: в Postgres несколько NULL уникальность не нарушают.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_device_id TEXT UNIQUE;
