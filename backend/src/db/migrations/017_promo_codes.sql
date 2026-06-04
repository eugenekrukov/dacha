-- Промокоды: бесплатный доступ к платным функциям по коду. Два типа:
--   lifetime — доступ навсегда; month — доступ на 30 дней (продлевается при повторном погашении).
-- Доступ от промокода хранится в users.promo_until ОТДЕЛЬНО от subscription_until — иначе
-- синхронизация подписки RuStore (POST /auth/subscription active=false → subscription_until=NULL)
-- затёрла бы выданный промо-доступ. Коды одноразовые, генерируются вручную скриптом scripts/gen-promo.js.

ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('lifetime', 'month')),
  redeemed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Быстрый поиск непогашенных кодов (админ-выборка/аудит)
CREATE INDEX IF NOT EXISTS idx_promo_codes_unredeemed ON promo_codes (code) WHERE redeemed_by IS NULL;
