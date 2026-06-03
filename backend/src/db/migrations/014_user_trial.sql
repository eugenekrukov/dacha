-- Серверный 7-дневный триал: привязываем начало пробного периода к пользователю.
-- Раньше срок считался на клиенте (first_launch_date в SharedPreferences) и обходился
-- сбросом данных/переустановкой. Теперь источник правды — сервер.
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Бэкофилл существующим пользователям: считаем триал от даты регистрации.
UPDATE users SET trial_started_at = created_at WHERE trial_started_at IS NULL OR trial_started_at > created_at;
