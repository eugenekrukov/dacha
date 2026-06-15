-- 036_account_management.sql
-- П4: управление аккаунтом. Идемпотентно. На проде применять ТОЧЕЧНО как app-юзер
-- (payments принадлежит dacha_user; готча владельца 009 не мешает — чистые ALTER).

-- Буфер для verify-first смены email
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);

-- payments: при удалении аккаунта строки сохраняем (чеки НПД), анонимизируя user_id.
-- Было: user_id NOT NULL ... ON DELETE CASCADE (миграция 024).
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
