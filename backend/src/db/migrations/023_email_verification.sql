-- Migration 023: Email verification + password reset
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 023_email_verification.sql
-- ВАЖНО после миграции: sudo -u postgres psql -d dacha_db -c "ALTER TABLE email_codes OWNER TO dacha_user;"
--   (иначе dacha_user поймает permission denied — та же грабля, что с promo_codes 017)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

-- Одноразовые коды для подтверждения email и сброса пароля.
-- purpose: 'verify' (подтверждение email) | 'reset' (сброс пароля).
CREATE TABLE IF NOT EXISTS email_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       VARCHAR(6) NOT NULL,
  purpose    VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Поиск активного кода по пользователю и назначению.
CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(user_id, purpose, used_at);

-- Флаг подтверждения email. Существующие пользователи (заведены ДО этой фичи, кода
-- подтверждения им никогда не выписывали) — грандфатеринг (verified = true), чтобы не
-- доставать их баннером; новые регистрации получают false и код через /auth/register.
--
-- Условие "нет ни одной строки в email_codes" вместо голого email_verified=false —
-- намеренно: находка 2026-08-11, при повторном прогоне этой миграции на проде бэкфилл
-- задним числом верифицировал двух пользователей, которые успели зарегистрироваться
-- (и получить свой verify-код) уже ПОСЛЕ выката фичи, но код так и не ввели — один из
-- адресов был на несуществующем домене. Прогон с исходным условием НЕ идемпотентен:
-- каждый повторный запуск подчищает всех, кто на тот момент ещё не подтвердил почту.
-- Условие через email_codes идемпотентно — у пользователя, заведённого после выката
-- (register всегда выпускает код), строка есть всегда, независимо от used_at.
UPDATE users SET email_verified = true
WHERE email_verified = false
  AND NOT EXISTS (SELECT 1 FROM email_codes ec WHERE ec.user_id = users.id);
