-- Migration 043: отписка от информационных писем (one-click unsubscribe)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 043_email_optout.sql
--
-- Контекст: письма жизненного цикла триала — информационные. По 38-ФЗ/152-ФЗ нужна возможность
-- отказаться. Флаг ставится по ссылке «Отписаться» из письма (GET /unsubscribe с подписанным токеном).
-- Технические письма (код подтверждения, чек) флагом НЕ управляются — приходят всегда.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_optout BOOLEAN NOT NULL DEFAULT false;
