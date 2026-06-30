-- 055_grant_garden_beds.sql
-- Выдать рантайм-пользователю dacha_user права на garden_beds и её sequence.
-- Таблица создана миграцией 052 от суперюзера postgres, поэтому права на неё
-- НЕ покрылись (в отличие от старых таблиц) и dacha_user получал
-- "permission denied for table garden_beds" (SQLSTATE 42501) при GET /gardens/:id/beds.
-- Идемпотентно: повторный GRANT безвреден.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE garden_beds TO dacha_user;
GRANT USAGE, SELECT ON SEQUENCE garden_beds_id_seq TO dacha_user;
