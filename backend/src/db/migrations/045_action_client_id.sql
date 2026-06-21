-- F1 офлайн «Сегодня»: идемпотентность офлайн-логирования действий.
-- client_id генерит клиент (UUID) при постановке в очередь; повторная отправка
-- того же действия (ретрай после частичного успеха) не задваивает строку.
ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS action_logs_client_id_uniq
  ON action_logs (client_id)
  WHERE client_id IS NOT NULL;
