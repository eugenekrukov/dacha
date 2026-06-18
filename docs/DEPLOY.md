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

---

## История

- **2026-06-12** — первый деплой веб-версии: backend (`store='web'`, `last_action_type`, фикс пушей),
  SPA в `/app/`, nginx `location /app/`, лендинг с входом в веб-версию. Подробности — `docs/web-migration-plan.md`.

## «Мой налог» (чеки НПД)

Авторегистрация дохода в ФНС после прекращения сервиса ЮKassa «Чеки для самозанятых» (29.12.2025).

Требования на сервере:
- RU forward-прокси (ФНС режет не-РФ IP): задать `NALOG_PROXY_URL` в `.env`.
- Точное время (NTP): `timedatectl set-ntp true` — ФНС отклоняет запросы при расхождении часов.
- Миграция 040: `ssh hetzner 'sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/040_nalog_receipts.sql'`
  затем `ssh hetzner 'sudo -u postgres psql -d dacha_db -c "ALTER TABLE nalog_auth OWNER TO dacha_user;"'`

Одноразовая авторизация (телефон + SMS):
```
cd /var/www/dacha-api/backend && node scripts/nalog-auth.js
```
Сохранит refresh_token в `nalog_auth` и выведет `NALOG_DEVICE_ID` — добавить в `.env`, затем `pm2 restart dacha-api`.

Если регистрация чеков начала падать (письма-алерты на ADMIN_EMAIL, `npd_status='failed'`):
проверить доступность прокси и при необходимости переавторизоваться скриптом выше.
