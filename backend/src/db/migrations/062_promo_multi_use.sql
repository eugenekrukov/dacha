-- Мультиключ: один промокод можно погасить нескольким пользователям (промо у блогера).
--   max_uses — сколько всего активаций разрешено (1 = прежний одноразовый код),
--   uses     — сколько уже израсходовано; лимит держится атомарным UPDATE ... WHERE uses < max_uses.
-- Кто именно погасил — в promo_redemptions: PK (code, user_id) не даёт одному пользователю
-- активировать один код дважды и заодно даёт статистику по кампании.
-- redeemed_by/redeemed_at на promo_codes оставлены как «первый погасивший» — на них завязаны
-- старые выборки (докa «Генерация промо-кодов», /statistic_user).

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS uses     INTEGER NOT NULL DEFAULT 0;

ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_uses_check;
ALTER TABLE promo_codes ADD  CONSTRAINT promo_codes_uses_check CHECK (max_uses >= 1 AND uses >= 0);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  code        TEXT        NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions (user_id);

-- Права рантайм-пользователю (таблица может быть создана от postgres — см. 055)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE promo_redemptions TO dacha_user;

-- Бэкофилл: уже погашенные одноразовые коды
INSERT INTO promo_redemptions (code, user_id, redeemed_at)
SELECT code, redeemed_by, COALESCE(redeemed_at, created_at) FROM promo_codes WHERE redeemed_by IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE promo_codes SET uses = 1 WHERE redeemed_by IS NOT NULL AND uses = 0;
