-- Migration 094: открытия статей блога из приложения (Android + веб-версия /app/).
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 094_article_opens.sql
--
-- ПРИЧИНА: статьи в приложении открываются ссылкой на сайт, отдельного события «открыл статью»
-- не было — читаемость внутри продукта считалась только косвенно (логи ленты, Метрика).
-- Одна строка на каждое нажатие по карточке; slug — из /blog/feed, source — где нажали
-- (today = «Статья дня», reference = вкладка «Справочник»).

CREATE TABLE IF NOT EXISTS article_opens (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  slug        TEXT NOT NULL,
  source      TEXT,
  store       TEXT,
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS article_opens_slug_idx ON article_opens (slug);
CREATE INDEX IF NOT EXISTS article_opens_created_idx ON article_opens (created_at);

ALTER TABLE article_opens OWNER TO dacha_user;
