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

## 6. Гейт free-тарифа: гейтить не только создание, но и запись по посадке

**Правило**: любой новый роут, который **пишет** данные, привязанные к посадке, обязан вызвать
`freeTierState` + `isPlantingLocked` из `utils/access.js` и вернуть `402 {error:'planting_locked'}`.
Одной проверки на создании (`POST /plantings`) недостаточно.

**Как нашли (2026-08-06)**: гейт `hasAccess` стоял ТОЛЬКО на `POST /plantings`. Всё остальное —
смена стадии, правка, журнал ухода, урожай, фото, напоминания — подписку не проверяло. Схема
обхода: купить подписку на месяц в начале сезона, завести все посадки, не продлевать и вести
сезон бесплатно. Автопродления нет ни в Google Play, ни в RuStore, так что дыра была рабочей.

**Правило блокировки** (`isPlantingLocked`): без платного доступа изменяемы только **первые
`FREE_PLANTING_LIMIT` активных посадок по id** (тот же набор, что считает лимит на создании).
Остальные видны, но только для чтения. Исключения — намеренные:
- `stage='done'` не блокируется (архив: дописать урожай после закрытия сезона);
- `PATCH /:id/stage` на `'done'` и `DELETE` разрешены всегда — «уменьшающие» операции освобождают
  слот, иначе выйти из лимита можно было бы только удалением данных.

`GET /plantings` и `GET /plantings/:id` отдают `locked: boolean` — клиенты рисуют read-only
заранее, а не узнают о блокировке из 402 по нажатию.

> ⚠️ Открытый хвост: `GET /today` по-прежнему считает care-задачи по ВСЕМ активным посадкам, не
> глядя на `locked`. Неплательщик с 50 посадками получает напоминания по всем — просто не может
> отметить выполнение. Закрывать ли — продуктовая развилка, не техническая.

---

## 7. Батч вместо N+1: последние действия по посадкам

**Правило**: когда нужны «последнее действие типа X по каждой посадке» для набора посадок — это ОДИН
запрос `DISTINCT ON (planting_id) … WHERE planting_id = ANY($1) … ORDER BY planting_id, logged_at DESC`,
а не `SELECT … LIMIT 1` в цикле по посадкам. Эталон — `routes/today.js` (`lastWateredMap` и др.).

**Как нашли (2026-07-04, M1)**: `careRemindersJob.js` (проходит по всем активным посадкам всех
пользователей) и `routes/recommendations.js` делали per-planting SELECT из `action_logs` в цикле —
масштабировалось линейно по всей базе. Свёрнуто в батч по `ANY($1)`.
