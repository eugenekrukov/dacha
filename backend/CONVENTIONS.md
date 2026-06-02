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
