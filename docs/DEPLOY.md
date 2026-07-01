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
VK_POST_LINK=https://dacha.studio1008.com   # опц., деф. = лендинг (уходит первым комментарием)
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
Формат файла контента — `## YYYY-MM-DD HH:MM — Заголовок` + тело + `Теги:` + `Картинка:` (время МСК).
Правка уже загруженного поста — в БД (`UPDATE vk_post_queue …`), файла недостаточно.
**Дзен — вручную:** API/RSS постинга у Дзена нет, тексты копировать из того же файла.

---

## История

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
