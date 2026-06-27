-- Migration 051: трекинг писем жизненного цикла ПЛАТНОЙ подписки (идемпотентность отправки)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 051_subscription_emails.sql
--
-- Контекст: subscriptionEmailsJob раз в день шлёт письма по смещению от subscription_until
-- (-3/0/3/30 дней). Ключ включает subscription_until (не только user_id+offset), потому что
-- пользователь может продлевать подписку несколько раз — у каждого цикла свой набор писем.

CREATE TABLE IF NOT EXISTS subscription_emails (
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_until  TIMESTAMPTZ NOT NULL,
  offset_days         INTEGER NOT NULL,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, subscription_until, offset_days)
);
