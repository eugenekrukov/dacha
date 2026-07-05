# Backend Conventions — Календарь дачника

> **Правило для Claude**: перед написанием любого роута или сервиса — прочитать хотя бы один
> аналогичный существующий файл. В конце сессии актуализировать этот файл если добавились новые паттерны.

---

## 1. Внешние API — регистр строковых полей

**Правило**: никогда не сравнивать поля внешних API с литералами без `.toLowerCase()` / `.toUpperCase()`.

Разные провайдеры возвращают одно и то же значение в разном регистре:

| API | Поле | Пример значения |
|-----|------|----------------|
| Photon (komoot) | `countrycode` | `"RU"` (заглавные) |
| Nominatim (OSM) | `countrycode` | `"ru"` (строчные) |

**Неправильно:**
```javascript
if (props.countrycode !== 'ru') continue  // ← ломается с Photon
```

**Правильно:**
```javascript
if (props.countrycode?.toLowerCase() !== 'ru') continue
```

> **Как нашли**: Photon возвращал `"RU"`, проверка была `!== 'ru'` — все результаты автодополнения
> городов молча отфильтровывались, поле не реагировало на ввод.

---

## 2. DECIMAL-колонки PostgreSQL → всегда приводить к числу

**Проблема**: `pg` (Node.js) возвращает `DECIMAL`/`NUMERIC` колонки как **строки**, а не числа.
Android-модели объявляют эти поля как `Double?` / `Int?` — Moshi не умеет парсить строку в число.

**Затронутые колонки:**

| Таблица | Колонки |
|---------|---------|
| `gardens` | `lat`, `lon` |
| `weather_snapshots` | `temp_c`, `min_temp_c`, `max_temp_c`, `wind_ms`, `precip_mm` |
| `harvests` | `weight_kg` |

**Правило**: в каждом роуте, который возвращает эти колонки — явно вызвать `parseFloat()` / `parseInt()`.
Использовать helper-функцию `normalizeXxx(row)` при маппинге результата.

```javascript
// Пример:
function normalizeGarden(g) {
  return { ...g, lat: g.lat != null ? parseFloat(g.lat) : null, lon: ... }
}
return result.rows.map(normalizeGarden)
```

> **Исключение**: `today.js` — там уже есть явный маппинг с `parseFloat()` для погодных полей.

---

## 3. Переменные окружения

БД подключается через отдельные переменные (не `DATABASE_URL`):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dacha_db
DB_USER=dacha_user
DB_PASSWORD=...
```

Конфигурация в `src/plugins/db.js`. При написании скриптов использовать эти переменные,
не `process.env.DATABASE_URL`.

---

## 3. Деплой

Порядок всегда: локальный коммит → push → git pull на VPS → pm2 restart.
pm2 process id = `1`, имя = `dacha-api`.

```bash
git pull origin main && pm2 restart 1
```

---

## 4. `npm run migrate` падает с «must be owner of table X»

**Проблема**: `migrate.js` перезапускает ВСЕ файлы миграций на каждом деплое (нет таблицы
отслеживания применённых) и падает на первой же ошибке — если упадёт на старой миграции, все
более новые (включая нужную прямо сейчас) не применятся вообще.

**Причина, найденная 2026-07-02**: таблицы `care_alert_log`, `garden_beds`, `subscription_emails`
в проде принадлежали роли `postgres`, а не `dacha_user` (от имени которой ходит `dacha-api`) —
судя по всему, создавались вручную через `sudo -u postgres psql` в какой-то момент истории проекта,
а не через обычный `npm run migrate`. Их `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS`
поэтому не идемпотентны в реальности: таблица уже есть, но менять/индексировать её от имени
`dacha_user` нельзя.

**Фикс** (от суперпользователя, `sudo -u postgres psql -d dacha_db`):
```sql
ALTER TABLE <table_name> OWNER TO dacha_user;
```
Проверить, есть ли ещё такие таблицы:
```sql
SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' AND tableowner <> 'dacha_user';
```
После фикса — `npm run migrate` снова.

---

## 5. Гейт доступа НЕ выводить из клиентских полей (безопасность монетизации)

**Правило**: право на платный доступ (`hasAccess` в `utils/access.js`) считается по серверным
данным — триал (`trial_started_at`), подписка (`subscription_until`), промо (`promo_until`). Поле
`store` — **клиентское** (приходит в теле `/auth/login` и `/auth/register`), поэтому оно НЕ должно
напрямую давать entitlement.

**Как нашли (2026-07-04, H1)**: `isAdSupportedStore('samsung')` → `hasAccess=true` без гейта, а
`login` молча писал присланный `store` в БД. Любой клиент, прислав `store:'samsung'`, получал
бесплатный доступ навсегда в обход оплаты.

**Правило при правке `store`**: не давать клиенту повысить себя до ad-supported магазина через
login/register. Разрешён `UPDATE users SET store`, только если новое значение НЕ ad-supported ЛИБО
аккаунт уже был на ad-supported:
```javascript
if (store && store !== user.store && (!isAdSupportedStore(store) || isAdSupportedStore(user.store))) {
  await db.query('UPDATE users SET store = $1 WHERE id = $2', [store, user.id])
}
```
> ⚠️ Остаётся вектор: `register` со `store:'samsung'` создаёт бесплатный ad-аккаунт. Полное решение —
> серверная верификация магазина установки, либо убрать store-based entitlement (samsung-флейвор
> ретайрится). Открытая продуктовая развилка — см. Obsidian «10 Открытые развилки».

---

## 6. Батч вместо N+1: последние действия по посадкам

**Правило**: когда нужны «последнее действие типа X по каждой посадке» для набора посадок — это ОДИН
запрос `DISTINCT ON (planting_id) … WHERE planting_id = ANY($1) … ORDER BY planting_id, logged_at DESC`,
а не `SELECT … LIMIT 1` в цикле по посадкам. Эталон — `routes/today.js` (`lastWateredMap` и др.).

**Как нашли (2026-07-04, M1)**: `careRemindersJob.js` (проходит по всем активным посадкам всех
пользователей) и `routes/recommendations.js` делали per-planting SELECT из `action_logs` в цикле —
масштабировалось линейно по всей базе. Свёрнуто в батч по `ANY($1)`.
