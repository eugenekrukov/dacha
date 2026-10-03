-- Migration 095: счётчик неверных попыток ввода кода из письма.
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 095_email_codes_attempts.sql
-- ⚠️ Применить ДО pm2 restart: новый код auth.js читает/пишет email_codes.attempts.
--
-- ПРИЧИНА: 6-значный код сброса пароля перебирался ограниченно только rate-limit'ом по IP —
-- с пулом прокси можно было распределить перебор. Теперь после MAX_CODE_ATTEMPTS неверных
-- вводов код перестаёт приниматься (нужно запросить новый).

ALTER TABLE email_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
