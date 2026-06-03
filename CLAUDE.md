# Dacha Kalendar — Claude Code Instructions

## Project Overview

Android-first mobile app for Russian gardeners (RuStore). Core value: practical daily help, planning automation based on geolocation, weather, and agro-logic.

## Stack

- **Android**: Kotlin, Jetpack Compose, Hilt, Retrofit, Moshi, Material3
- **Backend**: Node.js 20 + **Fastify 4** + PostgreSQL, pm2 on VPS
- **Auth**: JWT tokens via TokenStorage
- **Push**: RuStore Push SDK 6.0.0 (NOT Google FCM)

## Key Paths

- Local project: `C:\Projects\Dacha\Календарь дачника`
- Backend on VPS: `/var/www/dacha-api/backend/`, pm2 process: `dacha-api`
- Conventions: `android/CONVENTIONS.md` — **read before writing any Repository, ViewModel or Model**

## Core Entities

`User` · `Garden` · `Crop` · `Planting` · `ActionLog` · `Reminder` · `WeatherSnapshot` · `Recommendation` · `Harvest`

## Project Status

See `summary.md` for current task list and backlog.
See `session-note.md` for session logs.

## Документы — проверять в начале, обновлять в конце сессии

| Документ | Читать в начале | Обновлять в конце |
|----------|:--------------:|:-----------------:|
| `summary.md` | ✅ статус задач и бэклог | ✅ отметить выполненное |
| `session-note.md` | ✅ контекст предыдущей сессии | ✅ записать что сделано |
| `android/CONVENTIONS.md` | ✅ перед любым кодом | ✅ если добавились новые паттерны |
| `TESTING.md` | ✅ если пишем тесты или меняем логику | ✅ если изменилось поведение или добавлены кейсы |

---

## UI/UX Design Flow

### Источник правды по визуальному стилю

| Документ | Назначение |
|----------|-----------|
| `UI_MANIFEST.md` (корень) | Токены отступов, типографика, кнопки, карточки, иконки, правила Compose-кода, чеклист §11 |
| `ui/theme/Theme.kt` + `Type.kt` | Фактическая палитра «Solar Dacha» (`#FF7B00` / `#FFF8EB`, Nunito) и шрифты в коде |
| `design-system/календарь-дачника/MASTER.md` | Краткое описание стиля + указатель сюда же |

> ⚠️ Папка `design-system/.../pages/*.md` удалена: это был авто-сгенерированный скиллом
> контент под ошибочную категорию (community/social, gaming-стиль), не соответствующий
> реальному приложению. Не восстанавливать без проверки на соответствие UI_MANIFEST.

### Флоу при работе над экраном

```
1. Открыть UI_MANIFEST.md — раздел по типу компонента (кнопки, карточки, типографика, иконки)
2. Свериться с Theme.kt / Type.kt по цветам и шрифтам
3. Реализовать экран
4. Пройти чеклист UI_MANIFEST.md §11 перед коммитом
```

---

## Coding Rules

1. Read `android/CONVENTIONS.md` before writing any Repository, ViewModel or Model.
2. Use custom `Result` type (not `kotlin.Result`).
3. Backend code runs under `pm2` — use `.env` for ports, API keys, DB credentials.
4. Backend recommendations always consider 3 layers: **Crop + Location + Current Weather**.
5. Don't output large code blocks in chat — edit files directly.

## ⚠️ File Writing Rules (critical)

These rules exist because of past incidents that caused data loss and encoding corruption:

| Tool | Use for | Avoid for |
|---|---|---|
| **Write tool** | Основной способ для всех файлов, включая backend `.js` — сохраняет UTF-8 (кириллицу) | — |
| **SSH heredoc** (`cat > file << 'EOF'` на VPS) | Прямые правки `.js` на сервере | — |
| **Edit tool** | Мелкие точечные правки, в т.ч. с кириллицей (работает) | Осторожно на больших файлах — изредка может обрезать на Windows-путях |
| PowerShell `Set-Content` | **Никогда** | Любой файл с кириллицей — перекодирует UTF-8 как Windows-1252 |

**After writing any file via bash, verify:**
```bash
tail -3 /path/to/file   # check content not truncated
wc -c /path/to/file     # check size is reasonable
```

**SSH to VPS works only from PowerShell** (not from bash sandbox) — Windows SSH key is configured there.

---

## Git Workflow

- Работаем в ветке `feature/...` (текущая: `feature/ux-improvements`).
- Каждый этап: commit в feature → `git checkout main && git merge --ff-only feature/...` → push **обеих** веток. VPS тянет `main`.
- **Always commit + push locally BEFORE pulling on VPS.**
- Деплоим **только `dacha-api`** — не трогаем `landing-admin` / другие pm2-процессы на том же VPS.
- After finishing a feature: update `summary.md` (check off task) and append to `session-note.md`.

---

## Deploy

> **Git-модель (обязательна).** `main` — единственная интеграционная ветка; фичи вливаются в неё
> `--ff-only`. **VPS — read-only зеркало `origin/main`: на сервере НИКОГДА не коммитят и не правят
> файлы под git.** Поэтому деплой выполняется через `fetch + reset --hard origin/main`, а НЕ `git pull`
> (pull может создать merge-коммит и развести серверный `main` с origin — что ломает будущие деплои).
> Серверное состояние живёт вне git: `.env` (в `.gitignore`), pm2. `reset --hard` их не трогает.

```bash
# 1. LOCAL — commit and push first (always), деплоим с main
git add -A && git commit -m "feat/fix: description"
git checkout main && git merge --ff-only feature/... && git push origin main && git push origin feature/...

# 2. VPS — only after step 1. SSH ТОЛЬКО из PowerShell (ssh hetzner; bash не резолвит Windows-ключ)
ssh hetzner
cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main   # НЕ git pull
cd backend && npm install                        # if package.json changed
# Миграции — от суперюзера postgres (DDL/GRANT требуют прав; npm run migrate под dacha_user их не имеет):
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/0XX_*.sql   # если есть новая миграция
pm2 restart dacha-api
```

> If you skip step 1, `reset --hard origin/main` on VPS won't bring new code — deploy is pointless.
> Backend-тесты: `npx vitest run` (мок-БД, Postgres не нужен). Android-сборка из CLI:
> `$env:JAVA_HOME=...jbr; $env:ANDROID_HOME=...Sdk; gradlew.bat :app:compileDebugKotlin` (PowerShell).
