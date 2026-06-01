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

---

## UI/UX Design Flow

### Три документа — единая система

| Документ | Назначение | Когда читать |
|----------|-----------|--------------|
| `design-system/календарь-дачника/MASTER.md` | Визуальный стиль: палитра, типографика, эффекты, анти-паттерны | При создании нового экрана или компонента |
| `design-system/календарь-дачника/pages/[экран].md` | Переопределения стиля для конкретного экрана | Перед реализацией конкретного экрана — приоритет над MASTER |
| `UI_MANIFEST.md` | Технические правила Compose-кода: отступы, кнопки, типографика, иконки | При написании любого UI-кода на Kotlin/Compose |

### Флоу при работе над экраном

```
1. Открыть design-system/календарь-дачника/pages/[экран].md
   └── если файла нет → использовать MASTER.md

2. Открыть UI_MANIFEST.md
   └── раздел, соответствующий типу компонента (кнопки, карточки, типографика)

3. Реализовать экран, соблюдая оба документа

4. Пройти чеклист UI_MANIFEST.md §11 перед коммитом
```

### Обновление дизайн-системы

При изменении визуального языка (новый стиль, палитра, шрифт) — регенерировать через скилл:

```bash
# Обновить MASTER
python skills/ui-ux-pro-max/scripts/search.py "<запрос>" --design-system --persist -p "Календарь дачника"

# Обновить конкретную страницу
python skills/ui-ux-pro-max/scripts/search.py "<запрос>" --design-system --persist -p "Календарь дачника" --page "[экран]"
```

Скилл находится в `C:\Users\e-kru\.claude\skills\ui-ux-pro-max\`.

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
