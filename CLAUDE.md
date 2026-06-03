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

| Tool | Use for | Never use for |
|---|---|---|
| `bash cat > file << 'EOF'` | All backend `.js` files | — |
| Write tool | All files when bash is unavailable | Backend `.js` if bash works |
| Edit tool | **Never on Windows-mounted paths** | Any file in the project |
| PowerShell `Set-Content` | **Never** | Any `.js` file — corrupts Cyrillic to Windows-1252 |

**After writing any file via bash, verify:**
```bash
tail -3 /path/to/file   # check content not truncated
wc -c /path/to/file     # check size is reasonable
```

**SSH to VPS works only from PowerShell** (not from bash sandbox) — Windows SSH key is configured there.

---

## Git Workflow

- Create feature branch before starting: `git checkout -b feature/...`
- **Always commit + push locally BEFORE pulling on VPS.**
- After finishing a feature: update `summary.md` (check off task) and append to `session-note.md`.

---

## Deploy

```bash
# 1. LOCAL — commit and push first (always)
git add -A && git commit -m "feat/fix: description" && git push origin <branch>

# 2. VPS — only after step 1 (run from PowerShell)
ssh eugenekrukov@dacha.studio1008.com
cd /var/www/dacha-api/backend
git pull origin <branch>
npm install              # if package.json changed
npm run migrate          # if new migration files in src/db/migrations/
pm2 restart dacha-api
```

> If you skip step 1, `git pull` on VPS won't bring new code — deploy is pointless.
