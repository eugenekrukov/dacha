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

### SSH к VPS (важно — как подключается Claude)

- **Хост-алиас**: `hetzner` → `root@78.47.58.211`, конфиг `C:\Users\e-kru\.ssh\config`,
  ключ `C:\Users\e-kru\.ssh\hetzner` (ED25519, **зашифрован passphrase**).
- **Из bash-песочницы Claude НЕ работает `ssh hetzner`**: там MSYS-овый `/usr/bin/ssh` без доступа к
  Windows ssh-agent (`SSH_AUTH_SOCK` пуст), а ключ зашифрован → `Permission denied (publickey)`.
- **Рабочий способ из bash Claude** — вызывать Windows-клиент явно (он берёт расшифрованный ключ из
  Windows ssh-agent, где passphrase уже введён интерактивно):
  ```bash
  /c/Windows/System32/OpenSSH/ssh.exe hetzner "<команда>"
  ```
- Интерактивно у разработчика обычный `ssh hetzner` (PowerShell) работает как раньше.
- Предусловие: служба `ssh-agent` Running и ключ загружен (`ssh-add -l` показывает `hetzner`).

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

# 2. VPS — only after step 1.
#    Claude из bash: /c/Windows/System32/OpenSSH/ssh.exe hetzner "<cmd>"  (см. раздел «SSH к VPS»)
#    Разработчик интерактивно: ssh hetzner
cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main   # НЕ git pull
cd backend && npm install                        # if package.json changed
# Миграции — от суперюзера postgres (DDL/GRANT требуют прав; npm run migrate под dacha_user их не имеет):
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/0XX_*.sql   # если есть новая миграция
pm2 restart dacha-api
```

> If you skip step 1, `reset --hard origin/main` on VPS won't bring new code — deploy is pointless.
> Backend-тесты: `npx vitest run` (мок-БД, Postgres не нужен). Android-сборка из CLI:
> `$env:JAVA_HOME=...jbr; $env:ANDROID_HOME=...Sdk; gradlew.bat :app:compileDebugKotlin` (PowerShell).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **dacha** (1240 symbols, 1891 relationships, 74 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/dacha/context` | Codebase overview, check index freshness |
| `gitnexus://repo/dacha/clusters` | All functional areas |
| `gitnexus://repo/dacha/processes` | All execution flows |
| `gitnexus://repo/dacha/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
