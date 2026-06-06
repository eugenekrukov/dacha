-- Migration 024: Прямые платежи ЮKassa (рекуррент) — замена RuStore Billing
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 024_yookassa_billing.sql
-- ВАЖНО после миграции: sudo -u postgres psql -d dacha_db -c "ALTER TABLE payments OWNER TO dacha_user;"
--   (иначе dacha_user поймает permission denied — та же грабля, что с promo_codes 017 / email_codes 023)
--
-- Контекст: RuStore не подключает монетизацию самозанятым → переход на прямые платежи картой через
-- ЮKassa. Серверный гейт уже на «оплачено до даты» (users.subscription_until / hasAccess / 402) —
-- меняем ТОЛЬКО источник флага: вебхук ЮKassa вместо синка RuStore (POST /auth/subscription).

-- Токен сохранённой карты для автосписаний (рекуррент). NULL = карта не привязана.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

-- Автопродление включено (пользователь не отменил). При успешной оплате с сохранением карты → true;
-- «Отключить автопродление» в Настройках → false (доступ доживает до subscription_until и не продлевается).
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false;

-- Текущий тариф пользователя: 'monthly' (299 ₽/30 дн) | 'yearly' (1990 ₽/365 дн). Нужен для автосписания.
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;

-- История платежей + идемпотентность вебхуков (по UNIQUE yk_payment_id один и тот же платёж
-- не обрабатывается дважды).
CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yk_payment_id TEXT UNIQUE NOT NULL,     -- id платежа в ЮKassa
  status        TEXT NOT NULL,            -- pending | succeeded | canceled
  amount        NUMERIC(10,2),            -- сумма в рублях
  plan          TEXT,                     -- monthly | yearly
  is_recurring  BOOLEAN NOT NULL DEFAULT false,  -- автосписание (renewalJob) vs первичная оплата
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
