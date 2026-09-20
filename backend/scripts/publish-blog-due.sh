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

# Копируем всегда, а не только при новых статьях: если вчера копирование упало, сегодня догонит.
rsync -a --delete "$ROOT/landing/blog/" /var/www/dacha-landing/blog/
cp "$ROOT/landing/sitemap.xml" /var/www/dacha-landing/sitemap.xml

NEW=$(echo $NEW)
if [ -n "$NEW" ]; then
  node scripts/submit-indexnow.js $NEW
else
  echo "новых статей нет"
fi
