-- Migration 040: Регистрация чеков НПД через «Мой налог» (ФНС)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 040_nalog_receipts.sql
-- ВАЖНО после миграции: sudo -u postgres psql -d dacha_db -c "ALTER TABLE nalog_auth OWNER TO dacha_user;"
--
-- Контекст: сервис ЮKassa «Чеки для самозанятых» прекращён 29.12.2025. Доход в ФНС и чек НПД
-- регистрируем сами через API lknpd.nalog.ru. Очередь регистрации — колонки npd_* в payments.

-- Статус регистрации чека НПД по платежу:
--   NULL           — не подлежит (платёж до подключения / nalog отключён)
--   pending        — оплачен, ждёт регистрации дохода
--   registered     — доход зарегистрирован, чек сформирован (npd_receipt_uuid заполнен)
--   cancel_pending — был возврат, ждёт аннулирования чека
--   canceled       — чек аннулирован
--   failed         — регистрация/аннулирование не удались после ретраев (см. npd_last_error)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_status        TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_receipt_uuid  TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_attempts      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_last_error    TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_registered_at TIMESTAMPTZ;

-- Частичный индекс: быстрый разбор очереди (только активные статусы).
CREATE INDEX IF NOT EXISTS idx_payments_npd ON payments(npd_status)
  WHERE npd_status IN ('pending', 'cancel_pending');

-- Учётные данные «Мой налог»: одна строка (id=1). refresh_token живёт долго, access-токен
-- получаем из него в рантайме. inn — информационно (основной источник ИНН — env NALOG_INN).
CREATE TABLE IF NOT EXISTS nalog_auth (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  refresh_token TEXT,
  inn           TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nalog_auth_single_row CHECK (id = 1)
);
INSERT INTO nalog_auth (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE nalog_auth OWNER TO dacha_user;
