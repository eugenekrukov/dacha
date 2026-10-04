#!/bin/sh
# Публикует статьи блога, чьё время (scheduledAt в заголовке поста) уже настало.
# Cron на VPS (сервер в UTC; 00:00 МСК = 21:00 UTC):
#   0 21 * * * sh /var/www/dacha-api/backend/scripts/publish-blog-due.sh
# Лог: /var/log/dacha-blog-publish.log (переопределяется BLOG_PUBLISH_LOG).
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LOG=${BLOG_PUBLISH_LOG:-/var/log/dacha-blog-publish.log}
exec >>"$LOG" 2>&1
echo "== $(date -u +%FT%TZ)"
cd "$ROOT/backend"

# ponytail: смотрим два последних батч-файла; всё, что старше, давно опубликовано целиком.
NEW=""
for f in $(ls ../docs/vk-content/batch-*.md | tail -2); do
  out=$(node scripts/generate-blog.js "$f" --due)
  echo "$out"
  NEW="$NEW $(echo "$out" | sed -n 's/^NEW_URL: //p')"
done

# Перелинковка «Читайте также» зависит от соседей по манифесту: когда вышли новые статьи,
# перегенерируем уже опубликованные страницы из всех батчей, чтобы старые получили ссылки на новые.
if [ -n "$(echo $NEW)" ]; then
  for f in ../docs/vk-content/batch-*.md; do node scripts/generate-blog.js "$f" --refresh-existing >/dev/null; done
  echo "перелинковка обновлена"
fi

# sitemap.xml вне git и собирается двумя генераторами; generate-blog.js трогает только /blog/*.
# Если файл пересоздался без справочника (так было с 24.09), догенерируем справочник.
grep -q '/spravochnik/' "$ROOT/landing/sitemap.xml" || node scripts/generate-spravochnik.js || echo "WARN: generate-spravochnik.js упал, sitemap без справочника"


# Копируем всегда, а не только при новых статьях: если вчера копирование упало, сегодня догонит.
rsync -a --delete "$ROOT/landing/blog/" /var/www/dacha-landing/blog/
cp "$ROOT/landing/sitemap.xml" /var/www/dacha-landing/sitemap.xml

NEW=$(echo $NEW)
if [ -n "$NEW" ]; then
  node scripts/submit-indexnow.js $NEW
else
  echo "новых статей нет"
fi
