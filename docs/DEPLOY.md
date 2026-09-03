# Деплой и доступ к VPS

Прод: `dacha.studio1008.com` (Hetzner, `78.47.58.211`). На сервере:
- `dacha-api` (Fastify, порт 3002, pm2) — backend, каталог `/var/www/dacha-api` (клон репо, read-only зеркало `origin/main`).
- Лендинг — статика в `/var/www/dacha-landing` (**отдельный каталог**, деплоем `dacha-api` НЕ обновляется).
- Веб-версия (SPA) — статика в `/var/www/dacha-web`, nginx `location /app/`.
- nginx-конфиг сайта: `/etc/nginx/sites-available/dacha` (HTTPS через Certbot).

---

## ⚠️ Как подключаться: только через PowerShell

`ssh hetzner` (alias в `~/.ssh/config` → `root@78.47.58.211`, `IdentityFile ~/.ssh/hetzner`) работает
**только из PowerShell-инструмента**, а НЕ из Bash-инструмента.

- Ключ `~/.ssh/hetzner` **зашифрован паролем** и лежит в **службе Windows ssh-agent** (Windows OpenSSH,
  именованный канал). PowerShell использует Windows OpenSSH → ключ берётся из агента автоматически.
- Bash-инструмент (POSIX/MSYS) ищет ключ через `SSH_AUTH_SOCK`; POSIX-агент не запущен, а сам ключ
  расшифровать нечем → `Permission denied (publickey,password)`. Через Bash деплой невозможен.

Проверка доступа:
```powershell
ssh-add -l                 # должен показать ключ "hetzner (ED25519)"
ssh hetzner 'whoami'       # -> root
```

## ⚠️ Кавычки в удалённых командах (PowerShell → ssh)

PowerShell коверкает **двойные** кавычки при передаче нативному `ssh`. Правила:

1. **Удалённую команду обрамляй одинарными кавычками, без внутренних `"`.**
   ```powershell
   ssh hetzner 'cd /var/www/dacha-api && git reset --hard origin/main && pm2 restart dacha-api'
   ```
2. **Не используй `"`, `<`, `>` внутри** — `echo ""`, `grep -o "<title>"` и т.п. ломаются
   («unexpected EOF», «syntax error near `newline`»). Для статусов — без кавычек:
   ```powershell
   ssh hetzner 'curl -s -o /dev/null -w %{http_code} https://dacha.studio1008.com/app/'
   ```
   Для подсчётов — `grep -c /app/` (ASCII-паттерн без кавычек/скобок).
3. **Многострочные скрипты** — передавай через stdin одинарным here-string в `bash -s`:
   ```powershell
   $script = @'
   cp /etc/nginx/sites-available/dacha /etc/nginx/sites-available/dacha.bak.web
   awk '...' file > file
   nginx -t
   '@
   $script | ssh hetzner 'bash -s'
   ```
   ⚠️ PowerShell может добавить **BOM** в начало here-string → первая строка даст
   `set: command not found`. Не полагайся на `set -e` в первой строке (или поставь её не первой).

---

## Backend (dacha-api)

Сначала локально: влить в `main` и запушить (деплой тянет `origin/main`).
```powershell
git checkout main; git merge --ff-only <branch>; git push origin main
```
Затем на VPS:
```powershell
ssh hetzner 'cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main && pm2 restart dacha-api'
ssh hetzner 'curl -s localhost:3002/health'        # {"status":"ok",...}
```
- `npm install` — только если менялся `backend/package.json`.
- Миграции (если есть): `ssh hetzner 'sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/0XX_*.sql'`
  (+ `ALTER TABLE <t> OWNER TO dacha_user;` если таблица создана под postgres).
  ⚠️ **`npm run migrate` (backend/src/db/migrate.js) не годится** для точечного наката — он
  прогоняет ВСЕ .sql из каталога по порядку и падает на первой же, где `dacha_user` не владелец
  таблицы (например `073_crop_varieties.sql`: «must be owner of table crop_varieties» — старая,
  не связанная с текущей миграцией проблема), не доходя до новой. Если новая миграция — чистый
  DML (INSERT/UPDATE на уже существующих колонках, без ALTER TABLE/CREATE), её можно применить
  точечно из-под `dacha_user`, без sudo: небольшой inline-скрипт с `pg.Pool` на креды `.env` (те
  же, что использует сам бэкенд) и `pool.query(fs.readFileSync('<файл>.sql', 'utf8'))`. Если
  миграция меняет схему (новая таблица/колонка) — sudo-psql остаётся обязательным.
- **Новый батч ВК/Дзен (`docs/vk-content/*.md`)?** — загрузить в очередь, иначе `vkQueueJob`
  тихо простаивает (очередь пуста → публикаций нет, без ошибок в логах):
  `ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/vk-queue.js load ../docs/vk-content/<файл>.md'`
  (детали — раздел «Автопостер ВК» ниже). Проверить: `vk-queue.js list`.
- **Не `git pull`** (создаёт merge-коммит, разводит серверный main с origin).

## Веб-версия (SPA, `/app/`)

Собрать на VPS (Node 20 там есть) и выложить:
```powershell
ssh hetzner 'cd /var/www/dacha-api/web && npm ci && npm run build && mkdir -p /var/www/dacha-web && rm -rf /var/www/dacha-web/* && cp -r dist/* /var/www/dacha-web/'
```
nginx-блок (один раз) — в `/etc/nginx/sites-available/dacha`, **до** catch-all `location / { proxy_pass ... }`:
```nginx
location /app/ {
    alias /var/www/dacha-web/;
    try_files $uri $uri/ /app/index.html;
}
```
Применить:
```powershell
ssh hetzner 'nginx -t && systemctl reload nginx'
ssh hetzner 'curl -s -o /dev/null -w %{http_code} https://dacha.studio1008.com/app/'   # 200
```
Сборка использует `base: '/app/'` (vite.config.ts при `command==='build'`), ассеты резолвятся в `/app/assets/*`.

## Лендинг (отдельно!)

`/var/www/dacha-landing` не обновляется деплоем `dacha-api`. После правок `landing/*`:
```powershell
ssh hetzner 'cp /var/www/dacha-api/landing/index.html /var/www/dacha-landing/index.html && cp /var/www/dacha-api/landing/return.html /var/www/dacha-landing/return.html'
```
Если правили `offer.html` или `privacy.html` — скопировать и их (команда выше их не трогает), а также
**синхронизировать дублирующий текст в аккордеоне `#legal` внутри `index.html`** — см. `landing/README.md`.

### Шапка/подвал сайта (`landing/_includes/`) — сквозные через nginx SSI

Шапка (меню + кнопка входа) и подвал одинаковые на главной, `/spravochnik/` и `/blog/` — не
запечены в каждую страницу, а подключаются в момент запроса через `<!--#include virtual="/_includes/header.html" -->`
/ `.../footer.html` (nginx `ssi on;`, добавлено 2026-08-17). Страницы (включая уже
сгенерированные `generate-spravochnik.js`/`generate-blog.js`) достаточно один раз выложить —
правка меню/кнопки входа/подвала правит **два файла**, а не тысячи HTML.

После правки `landing/_includes/header.html` или `footer.html`:
```powershell
ssh hetzner 'cp -r /var/www/dacha-api/landing/_includes /var/www/dacha-landing/_includes'
```
Перегенерировать существующие страницы **не нужно** — SSI резолвится при каждом запросе.

nginx-конфиг (`/etc/nginx/sites-available/dacha`) уже содержит `ssi on;` (в `server{}`) и
`location /_includes/ { root /var/www/dacha-landing; internal; }` (внутренний — доступен только
из SSI-подзапроса, не по прямому URL). Ставится один раз, при первом деплое фичи уже сделано.

⚠️ **`cp -r <src>/assets <dst>/assets` при уже существующей `<dst>/assets`** кладёт `<src>/assets`
**внутрь** неё (`<dst>/assets/assets/`), а не поверх файлов — старая версия снаружи остаётся
нетронутой (грабли 2026-08-17, при точечном обновлении `spravochnik/assets/style.css`). Для
обновления одного файла — `cp file file` напрямую; для целой папки — либо `rm -rf <dst> && cp -r`
(как в командах выше для `spravochnik/`/`blog/`), либо `cp -r <src>/. <dst>/` (точка после `src`).

⚠️ **Правка nginx-конфига по SSH через PowerShell — не через `sed` с многострочной вставкой.**
Многострочный `sed -i '...i\...\n...\n...'`, переданный из PowerShell, ловит BOM/мусор в начале
героdoc-строки (см. правило про кавычки выше) и может тихо сломать файл на диске (грабли
2026-08-17). Безопасный путь: собрать готовый файл целиком локально, сверить `diff` с текущим
конфигом на сервере **до** применения, скопировать (`scp`) как замену, `nginx -t` — и только
затем `systemctl reload nginx`. Backup (`cp dacha dacha.bak.<суффикс>`) — перед любой правкой,
без исключений.

⚠️ **Новый файл в корне лендинга (`robots.txt`-подобный, не HTML-страница) не начинает отдаваться
сам по себе**, даже если он есть и в `landing/`, и в `/var/www/dacha-landing/` — нужен отдельный
`location = /имя.txt { root /var/www/dacha-landing; }` в `/etc/nginx/sites-available/dacha` (как для
`robots.txt`/`sitemap.xml`/`og.png` выше по файлу), иначе запрос падает в catch-all `proxy_pass` на
backend и получает 404 оттуда. Грабли `llms.txt` (2026-08-14): файл был закоммичен и лежал в обеих
директориях на сервере не менее пары недель, но location-блок так и не добавили — раздавался 404.
Добавить: `cp /etc/nginx/sites-available/dacha{,.bak}` → `sed -i '\#location = /sitemap.xml#a\    location = /имя.txt { root /var/www/dacha-landing; }' /etc/nginx/sites-available/dacha` → `nginx -t && systemctl reload nginx`.

⚠️ **Если в `.txt`-файле есть кириллица — добавить `charset utf-8;` в тот же location-блок**
(`location = /имя.txt { root /var/www/dacha-landing; charset utf-8; }`), иначе nginx отдаёт
`Content-Type: text/plain` без charset, и клиент сам угадывает кодировку (часто промахивается
на CP1251 → крякозябры), хотя сам файл на диске в порядке (UTF-8). HTML/XML эта проблема не
касается — там кодировка объявлена внутри файла (`<meta charset>`, XML-декларация). Грабли
`llms.txt` (2026-08-14, тем же заходом).

### Справочник `/spravochnik/` (SEO-страницы культур и проблем растений)

Генерируется скриптом из БД, не редактируется руками. После изменения данных
культур/справочника (или при первом деплое фичи):

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/backfill-crop-slugs.js && node scripts/generate-spravochnik.js'
ssh hetzner 'rm -rf /var/www/dacha-landing/spravochnik && cp -r /var/www/dacha-api/landing/spravochnik /var/www/dacha-landing/spravochnik && cp /var/www/dacha-api/landing/sitemap.xml /var/www/dacha-landing/sitemap.xml'
```

Требуется миграция `056_crops_slug.sql` (накатывается обычным деплоем `dacha-api`,
см. выше в этом файле) и один новый location-блок в nginx-конфиге сайта
(`/etc/nginx/sites-available/dacha`), добавить ПЕРЕД проксирующим `location /`:

```nginx
location /spravochnik/ {
    root /var/www/dacha-landing;
    try_files $uri $uri/ =404;
}
```

Затем `sudo nginx -t && sudo systemctl reload nginx`. Location-блок нужен один раз,
дальше только перегенерация содержимого.

### Блог `/blog/` (статьи из контент-плана ВК/Telegram/Дзен)

Генерируется из файлов `docs/vk-content/*.md` (тот же формат, что грузится в очередь
автопостера, см. «Автопостер ВК» ниже) — НЕ из БД, парсер общий с `vk-queue.js`
(`src/services/vkContent.js`). **В блог идёт весь файл целиком**, включая уже
опубликованные в ВК посты — сайт хранит архив, а не только анонсы будущего (решение
2026-08-13, отменяет прежний фильтр «только с завтра» от 2026-07-18). Гонять один и тот
же батч-файл повторно безопасно — по заголовку находится существующая страница
и просто перезаписывается, дублей не плодит.

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/generate-blog.js ../docs/vk-content/<файл>.md'
ssh hetzner 'rm -rf /var/www/dacha-landing/blog && cp -r /var/www/dacha-api/landing/blog /var/www/dacha-landing/blog && cp /var/www/dacha-api/landing/sitemap.xml /var/www/dacha-landing/sitemap.xml'
```

**Нужно обновить обёртку (шапку/подвал/что-то в `renderShell`) на уже опубликованных постах, но
не публиковать остальные статьи файла?** — флаг `--refresh-existing` (2026-08-17): фильтрует по
совпадению `title` с уже существующей записью в `.blog-manifest.json`, не по имени файла (исходный
`.md`, из которого пост когда-то публиковался, мог с тех пор переименоваться/исчезнуть — так и
было с `filtered-part1-aug.md`/`filtered-part2-jul.md`, найти текущий файл-эквивалент можно только
сверкой заголовков). Без флага «весь файл целиком» опубликовал бы и статьи, которых в блоге ещё нет —
не всегда то, что нужно при простом обновлении шапки:

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/generate-blog.js ../docs/vk-content/<файл>.md --refresh-existing'
```

**Фид приложения (`GET /blog/feed`, добавлен 2026-09-03)** читает те же файлы — манифест
(`.blog-manifest.json`) + исходники `docs/vk-content/*.md` — что и генератор блога выше.
Публикация статьи (шаги над этим блоком) автоматически появляется и в приложении: **отдельного
шага деплоя нет**, фид просто перечитывает манифест при изменении его `mtime`.

⚠️ **Требовал точечной правки nginx (сделано на проде 2026-09-03).** Публичные страницы блога
редиректят на `calendacha.ru` префиксным `location /blog/ { return 301 ...; }` (см. ниже) — этот
же префикс молча ловил и API-роут `/blog/feed`, 301-я его на статический лендинг вместо ответа
от бэкенда (баг замечен и исправлен сразу при первом деплое фичи). Фикс — точный `location =`
**перед** префиксным блоком (nginx матчит `=` вне зависимости от порядка, но так нагляднее):
```nginx
location = /blog/feed {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
Ставится один раз, уже в конфиге на проде. При переносе на другой домен/окружение — не забыть.

**При подготовке каждого нового батча — секция `FAQ:` обязательна** (правило владельца,
2026-08-13), по аналогии с `Telegram:`. 2–4 пары `В:`/`О:` на пост, отделены пустой строкой,
ставится в тексте между основным телом и `Telegram:`:

```
FAQ:
В: Вопрос по существу статьи?
О: Ответ в 1–2 предложения.

В: Второй вопрос?
О: Второй ответ.
```

В ВК/Дзен/Telegram не публикуется — только в блог на сайте: рендерится секцией
«Частые вопросы» (`<details>/<summary>`) и схемой `FAQPage`/`Question`/`Answer`
(JSON-LD, `faqJsonLd` в `lib/seoPage.js`) в `<head>` страницы поста. Парсер —
`parseFaq()` в `src/services/vkContent.js`.

Идемпотентно — повторный прогон того же файла не плодит дублей (состояние в
`backend/scripts/.blog-manifest.json`, не в git, живёт на VPS постоянно — `git reset --hard`
его не трогает, т.к. файл untracked). Публичные страницы блога (не путать с фидом приложения
выше) обслуживаются `calendacha.ru`, а не `dacha.studio1008.com` — nginx-конфиг сайта редиректит
префикс целиком (SEO-миграция 2026-08-25, уже в проде):

```nginx
location /blog/ {
    return 301 https://calendacha.ru$request_uri;
}
```

Затем `sudo nginx -t && sudo systemctl reload nginx`. `sitemap.xml` общий со `/spravochnik/` —
оба генератора мержат файл по своей зоне URL (`lib/seoPage.js` `mergeSitemapUrls`), не
затирая записи друг друга — порядок прогона `generate-spravochnik.js`/`generate-blog.js`
не важен.

### IndexNow (быстрая индексация Яндекс/Bing при добавлении страниц)

Одноразовая настройка: сгенерировать ключ, положить файл-подтверждение `{ключ}.txt` в корень сайта
(содержимое файла = сам ключ), добавить `INDEXNOW_KEY` в `.env` backend, добавить nginx-блок:

```nginx
location = /{ключ}.txt { root /var/www/dacha-landing; }
```

После каждой перегенерации `/spravochnik/` или `/blog/`, если появились новые/удалённые страницы
(скрипт берёт URL из общего `sitemap.xml`, платформу не различает):

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/submit-indexnow.js'
```

Скрипт (`backend/scripts/submit-indexnow.js`) берёт все URL из `landing/sitemap.xml` и отправляет
их одним POST-запросом на `https://yandex.com/indexnow` — по протоколу IndexNow это уведомляет и
других участников (Bing и т.д.), не только Яндекс. Не гарантирует индексацию, только ускоряет обход.

---

## Автопостер ВК (маркетинг, `vk-queue`)

Агент-автопостер: cron-джоб `jobs/vkQueueJob.js` (`*/10`) публикует «созревшие» посты из таблицы
`vk_post_queue` (миграция **048**) в сообщество ВК. Очередь наполняется заранее из md-файла контента.
Без env (`VK_GROUP_ID`+`VK_ACCESS_TOKEN`) джоб idle — деплоить безопасно.

**Деплой:** обычный backend (`reset --hard` + `pm2 restart`); миграция один раз:
`sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/048_vk_post_queue.sql` (внутри уже
`ALTER TABLE … OWNER TO dacha_user`).

**`.env` (Hetzner):**
```
VK_GROUP_ID=239559357           # числовой id сообщества (calendacha), без минуса
VK_ACCESS_TOKEN=vk1.a.XXXX       # ПОЛЬЗОВАТЕЛЬСКИЙ токен админа группы (НЕ community)
VK_POST_LINK=https://calendacha.ru   # опц., деф. = лендинг (уходит первым комментарием)
```
⚠️ **Только пользовательский токен.** Community-токен не умеет загружать фото на стену
(`photos.getWallUploadServer` → ошибка 27). Получить user-токен: implicit flow через **Kate Mobile**
(свои новые VK-приложения VK гонит в VK ID, где scope `offline` невалиден):
```
https://oauth.vk.com/authorize?client_id=2685278&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,groups,offline&response_type=token&v=5.199&display=page
```
→ из `#access_token=vk1.a.…&expires_in=0` (0 = бессрочный). Комментарий со ссылкой шлётся **от лица
админа** (без `from_group` — community-комментарий требует community-токена, ошибка 15). После смены
токена в `.env` — `pm2 restart dacha-api`.

**Управление очередью** (на сервере, `cd /var/www/dacha-api/backend`):
```
node scripts/vk-queue.js load ../docs/vk-content/<файл>.md   # загрузить посты в очередь
node scripts/vk-queue.js list                                # статусы очереди
node scripts/vk-autopost.js --text-file post.txt --image url --link <url> [--dry]   # разовый пост
```
Формат файла контента — `## YYYY-MM-DD HH:MM — Заголовок` + тело + опц. секция `Telegram:` (короткая
версия для канала, см. ниже) + `Теги:` + `Картинка:` (время МСК).
Правка уже загруженного поста — в БД (`UPDATE vk_post_queue …`), файла недостаточно.
**Дзен — вручную:** API/RSS постинга у Дзена нет, тексты копировать из того же файла.

---

## Автопостер Telegram (маркетинг, тот же `vk-queue`)

Агент-автопостер: cron-джоб `jobs/telegramQueueJob.js` (`*/10`) публикует «созревшие» посты из
той же таблицы `vk_post_queue` (миграция **058**, колонки `telegram_*`) в Telegram-канал через
Bot API. Очередь наполняется тем же CLI, что и для ВК (`scripts/vk-queue.js load <файл>`) —
отдельного скрипта загрузки не нужно. Без env (`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHANNEL_ID`) джоб
idle — деплоить безопасно.

**Текст поста — отдельный от ВК/Дзен-лонгрида** (с 2026-07-27, миграция **059**, колонка
`telegram_body`): секция `Telegram:` в файле контента (хук-эмодзи первой строкой, короткие абзацы,
без markdown-заголовков, `**жирный**` конвертируется в `<b>` при публикации — см. `telegramService.js`
`mdBoldToHtml`). Если секции нет — джоб молча фолбэчится на общий `body` (старое поведение, механистичный
репост лонгрида); **при подготовке нового батча секцию `Telegram:` писать сразу**, не постфактум.

Пост — всегда одно сообщение (фото+текст вместе, не разбивается на два). Ссылка на лендинг в
каждом посте **не** ставится (решили, что это выглядит как спам) — вместо неё, если текст не
влезает в лимит (4096 симв. без фото / 1024 симв. подписи к фото), он аккуратно обрезается по
границе слова и в конец добавляется «Читать полностью: {ссылка на этот же пост в ВК}» (`vk_post_url`
из той же строки очереди). `TELEGRAM_POST_LINK` — только фолбэк на случай, если пост ещё не
опубликован в ВК (`vk_post_url` пуст).

**Деплой:** обычный backend (`reset --hard` + `pm2 restart`); миграции один раз:
```
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/058_telegram_queue_columns.sql
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/059_telegram_body.sql
```
(как и остальные миграции на VPS — `dacha_user` не имеет прав DDL). Правка `telegram_body` для уже
загруженных (но ещё не опубликованных) постов — тоже через `UPDATE vk_post_queue`, файл-источник
на очередь повторно грузить нельзя (`vk-queue.js load` только INSERT, задублирует посты).

**Еженедельный промо-пост** (`jobs/telegramWeeklyPromoJob.js`) — единственное место, где в канале
всё же появляется ссылка на лендинг: фиксированный текст, по понедельникам в 10:00 МСК (cron с
явной `timezone: 'Europe/Moscow'`, сервер сам в UTC). Включается тем же env, что и очередь.
Текст поста — константа `PROMO_TEXT` в файле джоба, править прямо там.

**`.env` (Hetzner):**
```
TELEGRAM_BOT_TOKEN=8333482648:AAFY...        # токен от BotFather, бот @calendacha_bot
TELEGRAM_CHANNEL_ID=@calendacha              # публичный канал → username вместо числового chat_id
TELEGRAM_POST_LINK=https://calendacha.ru   # опц., фолбэк «читать полностью» если vk_post_url ещё пуст
```
Канал должен быть публичным (с `@username`) — тогда `chat_id` для Bot API это сам username, не
нужно вычислять числовой id через `getUpdates`. Бот должен быть добавлен в канал администратором
с правом «Публикация сообщений» — без этого `sendMessage`/`sendPhoto` вернёт 403.

---

## История

- **2026-07-27 (2)** — Telegram-автопостер: короткий формат постов вместо репоста ВК-лонгрида.
  Миграция **059** (`telegram_body` в `vk_post_queue`), секция `Telegram:` в формате файла контента
  (`vkContent.js`), фолбэк на общий `body`, если секции нет. `**bold**` → `<b>` при публикации
  (`telegramService.js`). Деплой backend + миграция 059 на VPS выполнены; `batch-2026-07-part3.md`
  backfill'нут для ещё не опубликованных постов (id 48–52) — первый пост батча (id 47, «Лук») уже
  ушёл в канал со старым общим текстом до фикса, задним числом не правился.
- **2026-07-01 (2)** — UX-правки грядок: «Условия» (грунт/теплица) убраны из формы создания
  (дубль с типом грядки) — значение берётся из грядки/дефолт «грунт», редактируется в карточке посадки;
  на вебе добавлен выбор «Способ посадки» (рассада/семена, дефолт по `transplant_days`). Деплой web-only:
  `reset --hard origin/main` + `npm ci && npm run build` → `/var/www/dacha-web` (бэкенд не менялся).
  Проверено вживую: `/app/` 200, форма без «Условий» + выбор способа, правка «Условий» в карточке (PATCH).
  Android — те же правки в `main` (compile + unit-тесты зелёные), ждёт релиза (см. предыдущую запись).

- **2026-07-01** — фича «Грядки участка + севооборот» (web + Android). Бэкенд был задеплоен ранее
  (миграции 052/053); в этот заход — миграция **055** `GRANT` на `garden_beds`+sequence для `dacha_user`
  (без неё `GET /gardens/:id/beds` падал с `permission denied`, 42501). GRANT применён на проде inline
  (`sudo -u postgres psql -d dacha_db -c 'GRANT SELECT,INSERT,UPDATE,DELETE ON garden_beds TO dacha_user;
  GRANT USAGE,SELECT ON garden_beds_id_seq TO dacha_user;'`), файл миграции — для воспроизводимости.
  Деплой: backend `reset --hard origin/main` + `pm2 restart` (JS не менялся), web пересобран
  (`npm ci && npm run build` → `/var/www/dacha-web`). Проверено: `/app/` 200, `GET /gardens/12/beds` 200.
  **Android** (поле «Место», пикер грядок, подсказка севооборота) влит в `main`, собран локально
  (rustore debug APK + юнит-тесты зелёные) — **релиз в RuStore выкладывается вручную** (подпись +
  консоль RuStore; RuStore копит версии, публикуется отдельно).

- **2026-06-24 (2)** — фото в групповом действии при 1 культуре, фикс лейбла `transplanting`
  (`web/src/api/labels.ts` собран из `ACTION_CATALOG`), Яндекс.Метрика (id `110118201`) и
  cookie-уведомление на лендинге и в веб-версии. Деплой: backend без изменений, `web` пересобран
  (`npm ci && npm run build` → `/var/www/dacha-web`), `landing/index.html`+`privacy.html` скопированы
  в `/var/www/dacha-landing`. **Грабли:** `<noscript>` со вложенным `<div>` в `<head>` — невалиден по
  HTML5, Vite (`parse5`) валит сборку с `disallowed-content-in-noscript-in-head` — фолбэк перенесён в
  `<body>`.

- **2026-06-24** — единый блок «действие+заметка+фото» (`/feed` запись-центричный, без миграции) +
  автопостер ВК: миграция **048** (`vk_post_queue`), cron `vkQueueJob`, env `VK_*` (раздел выше).
  Деплой обычный (`reset --hard` + `pm2 restart`).

- **2026-06-21 (2)** — правки тестеров + Tier 2 (vc6). Миграции **046** (`plantings.variety`) и **047**
  (`crops.image_url/image_credit`) — аддитивные. Backend (группировка полива/подкормки в `todayLogic`,
  variety) + web (hero, фото-дневник, фото культур lazy-load) задеплоены: `reset --hard origin/main`,
  psql 046+047, `pm2 restart`, `npm run build` → `/var/www/dacha-web`. Android vc6/1.0.3 — пользователь.
- **2026-06-12** — первый деплой веб-версии: backend (`store='web'`, `last_action_type`, фикс пушей),
  SPA в `/app/`, nginx `location /app/`, лендинг с входом в веб-версию. Подробности — `docs/web-migration-plan.md`.

## «Мой налог» (чеки НПД)

Авторегистрация дохода в ФНС после прекращения сервиса ЮKassa «Чеки для самозанятых» (29.12.2025).

Требования на сервере:
- RU-транспорт к ФНС (режет не-РФ IP) — один из двух (см. ниже): PHP-релей или forward-прокси.
- Точное время (NTP): `timedatectl set-ntp true` — ФНС отклоняет запросы при расхождении часов.
- Миграция 040: `ssh hetzner 'sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/040_nalog_receipts.sql'`
  затем `ssh hetzner 'sudo -u postgres psql -d dacha_db -c "ALTER TABLE nalog_auth OWNER TO dacha_user;"'`

### RU-транспорт, вариант 1 — PHP-релей (RU shared-хостинг, без VPS)
1. Сгенерируй секрет: `openssl rand -hex 32`.
2. Скопируй `backend/scripts/nalog-relay.php` в `public_html` российского хостинга. Задай в нём секрет —
   через переменную окружения `NALOG_RELAY_SECRET` либо впиши в `$RELAY_SECRET`. По желанию ограничь
   по IP: `NALOG_RELAY_ALLOW_IP=78.47.58.211`.
3. Проверь с Hetzner (ожидаем ответ ФНС, не `relayError`):
   ```
   curl -s -X POST https://ТВОЙ-ДОМЕН/nalog-relay.php \
     -H "X-Relay-Secret: СЕКРЕТ" -H "X-Relay-Path: /auth/token" \
     -H "Content-Type: application/json" -d '{}'
   ```
4. На Hetzner в `.env`: `NALOG_RELAY_URL=https://ТВОЙ-ДОМЕН/nalog-relay.php` и `NALOG_RELAY_SECRET=СЕКРЕТ`.

### RU-транспорт, вариант 2 — forward-прокси (RU VPS)
Поднять Squid/3proxy на RU-VPS (ограничить доступ IP Hetzner `78.47.58.211` и доменом `lknpd.nalog.ru`),
затем в `.env`: `NALOG_PROXY_URL=http://IP_VPS:3128`.

> Если заданы оба транспорта — приоритет у релея (`NALOG_RELAY_URL`).

Одноразовая авторизация (телефон + SMS) — ходит к ФНС через тот же транспорт:
```
cd /var/www/dacha-api/backend && node scripts/nalog-auth.js
```
Сохранит refresh_token в `nalog_auth` и выведет `NALOG_DEVICE_ID` — добавить в `.env`, затем `pm2 restart dacha-api`.

Если регистрация чеков начала падать (письма-алерты на ADMIN_EMAIL, `npd_status='failed'`):
проверить доступность транспорта (релея/прокси) и при необходимости переавторизоваться скриптом выше.
