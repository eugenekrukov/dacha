-- Migration 041: флаг тест-аккаунтов — основа для чистой воронки (pre-launch)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 041_analytics_is_test.sql
--
-- Контекст: до запуска маркетинга все регистрации — тестовые (синтетические + личные аккаунты
-- разработчика + gplay-тестеры). Чтобы метрики первой РЕАЛЬНОЙ когорты считались корректно,
-- помечаем тест-аккаунты флагом is_test и исключаем их в статистике/воронке.
-- Ведём флаг СПИСКОМ (а не маской в каждом запросе): один источник истины.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Одноразовая пометка заведомо синтетических аккаунтов по шаблону.
UPDATE users SET is_test = true WHERE (
     email ILIKE 'test@%'
  OR email ILIKE 'demo@%'
  OR email ILIKE 'deploytest_%'
  OR email ILIKE '%@example.com'
  OR email ILIKE '%@dacha.ru'
);

-- Личные тест-аккаунты разработчика (указаны явно владельцем проекта).
UPDATE users SET is_test = true WHERE email IN (
  'krukov1@gmail.com',
  'e-krukov@ya.ru',
  'e-krukov@yandex.ru'
);

-- Прочих gplay-тестеров без синтетического email пометить вручную одной строкой, например:
--   UPDATE users SET is_test = true WHERE email = 'tester@example.org';

-- Индекс под выборки «только реальные пользователи».
CREATE INDEX IF NOT EXISTS idx_users_real ON users(created_at) WHERE is_test = false;
