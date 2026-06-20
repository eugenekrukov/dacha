-- Migration 042: трекинг писем жизненного цикла триала (идемпотентность отправки)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 042_trial_emails.sql
--
-- Контекст: trialEmailsJob раз в день шлёт письма по дню триала (1/3/5/6/8). Чтобы не дублировать,
-- фиксируем (user_id, day) отправленных писем. day — номер дня триала, на который ушло письмо.

CREATE TABLE IF NOT EXISTS trial_emails (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);
