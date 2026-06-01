# Архитектура: Календарь дачника

## Стек технологий

| Слой | Технологии |
|------|-----------|
| **Backend** | Node.js 20, Fastify 4, PostgreSQL, node-cron, node-fetch |
| **Android** | Kotlin, Jetpack Compose, Hilt (DI), Retrofit + Moshi, WorkManager, RuStore Push SDK 6.0.0 |
| **Инфраструктура** | VPS (Hetzner 78.47.58.211), nginx reverse proxy, pm2, Let's Encrypt SSL |

---

## Бэкенд

### Точка входа
- `backend/src/app.js` — инициализация Fastify, плагины, маршруты, фоновые джобы

### Структура
```
backend/src/
├── app.js               — точка входа, регистрация всего
├── plugins/
│   └── db.js            — pg Pool (fastify.db)
├── routes/              — HTTP-обработчики
│   ├── auth.js          — POST /auth/register, login, GET /auth/me
│   ├── gardens.js       — CRUD участков + геокодирование Nominatim
│   ├── crops.js         — справочник культур (admin-guard для записи)
│   ├── plantings.js     — посадки: CRUD + PATCH /stage + PATCH /info
│   ├── actions.js       — журнал действий + CSV-экспорт
│   ├── recommendations.js — трёхслойные рекомендации
│   ├── today.js         — агрегирующий GET /today
│   ├── weather.js       — GET /weather (кэш WeatherSnapshot)
│   ├── harvests.js      — учёт урожая
│   ├── reminders.js     — напоминания
│   ├── push-tokens.js   — RuStore push-токены
│   └── analytics.js     — GET /analytics/summary
├── services/
│   ├── weatherService.js   — интеграция Open-Meteo
│   └── pushService.js      — RuStore Push API
├── jobs/
│   ├── weatherJob.js       — cron каждые 3 часа, обновление погоды + frost_alert
│   └── careRemindersJob.js — cron ежедневно 09:00, watering_due + fertilizing_due
├── utils/
│   ├── todayLogic.js       — чистые функции buildTasks / formatTasks
│   └── regionCoords.js     — координаты регионов РФ + климатические зоны
└── db/
    └── migrations/          — SQL миграции 001–009
```

### API эндпоинты
```
POST /auth/register       POST /auth/login         GET /auth/me
POST /gardens             GET /gardens             GET /gardens/:id     PUT /gardens/:id
GET /crops                GET /crops/:id           POST /crops          PUT /crops/:id
POST /plantings           GET /plantings           GET /plantings/:id
  PATCH /plantings/:id/stage    PATCH /plantings/:id/info    DELETE /plantings/:id
POST /actions             GET /actions             GET /actions/export
GET /weather?garden_id=
GET /recommendations?garden_id=
GET /today?garden_id=
POST /reminders           GET /reminders
GET /harvests             POST /harvests
POST /push-tokens         DELETE /push-tokens
GET /analytics/summary
```

### Логика рекомендаций (3 слоя)
1. **Культура** — `watering_freq_days`, `harvest_days`, `frost_sensitive`, `fertilizing_schedule`
2. **Локация** — `climate_zone` (USDA 3–6), регион
3. **Погода** — `temp_min`, `frost_risk`, `heat_risk` из WeatherSnapshot

Теплица (`conditions='greenhouse'`): снимает frost_alert, +30% к интервалу полива.

### Приоритеты задач в GET /today
1. `frost_alert` (риск заморозков)
2. `transplant_due` (пора пересадить)
3. `watering_due` (полив просрочен)
4. `harvest_due` (урожай готов)
5. `reminder` (ручное напоминание)

### Push-уведомления
| Триггер | Когда | Джоб |
|---------|-------|------|
| `frost_alert` | temperature ≤ 2°C | weatherJob.js |
| `watering_due` | days ≥ wateringFreq | careRemindersJob.js (09:00) |
| `fertilizing_due` | days > 14 | careRemindersJob.js (09:00) |

Дедупликация: `care_alert_log` — не более 1 пуша на посадку/тип/день.

### Деплой
```bash
# VPS: /var/www/dacha-api
cd /var/www/dacha-api && git pull origin main
cd backend && npm install
pm2 reload dacha-api

# Миграции
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/00X_name.sql
```

---

## Android

### Package
`ru.dachakalend.app` · minSdk 26 · targetSdk 34

### Структура
```
android/app/src/main/java/ru/dachakalend/app/
├── App.kt                 — Hilt application, RuStorePushClient.init()
├── MainActivity.kt        — NavHost, BottomNavigation, Screen routing
├── data/
│   ├── api/
│   │   └── DachaApi.kt    — Retrofit интерфейс (все эндпоинты)
│   ├── local/
│   │   └── TokenStorage.kt — SharedPreferences: token, gardenId, climateZone, plantingsCount
│   ├── model/
│   │   └── Models.kt      — все data-классы (Moshi)
│   └── repository/        — репозитории по доменным областям
├── navigation/
│   └── Navigation.kt      — sealed class Screen, bottomNavItems
├── notification/
│   └── DachaPushService.kt — RuStoreMessagingService
└── ui/
    ├── auth/              — LoginScreen, RegisterScreen, AuthViewModel
    ├── garden/            — CreateGardenScreen, GardenEditScreen, GardenViewModel, GardenEditViewModel
    ├── today/             — TodayScreen, TodayViewModel
    ├── calendar/          — CalendarScreen, CalendarViewModel
    ├── crops/             — CropsScreen, CropDetailScreen, CropsViewModel
    ├── plantings/         — PlantingsScreen, PlantingsViewModel, PlantingInfoBottomSheet
    ├── actions/           — ActionLogBottomSheet, ActionLogViewModel
    ├── harvest/           — HarvestScreen, HarvestViewModel
    ├── analytics/         — AnalyticsScreen, AnalyticsRepository
    └── theme/             — DachaCalendarTheme
```

### Навигация (Screen routes)
| Screen | Route | Описание |
|--------|-------|----------|
| Login | `login` | Авторизация |
| Register | `register` | Регистрация |
| CreateGarden | `create_garden` | Первичный онбординг |
| GardenEdit | `garden_edit` | Редактирование участка |
| Today | `today` / `today?fromOnboarding=true` | Главный экран |
| Calendar | `calendar` | Календарь работ |
| Plantings | `plantings` / `plantings?newCropId={id}` | Список посадок |
| Harvest | `harvest` | Урожай |
| Crops | `crops` | Справочник культур |
| CropDetail | `crop_detail/{cropId}?showPlantButton={bool}` | Карточка культуры |

### Репозитории
| Репозиторий | Основные методы |
|-------------|----------------|
| `TodayRepository` | `getToday()` |
| `GardenRepository` | `loadGardens()`, `createGarden()`, `updateGarden()` |
| `CropsRepository` | `getCrops(category?)`, `getCrop(id)` |
| `PlantingsRepository` | `getPlantings()`, `createPlanting()`, `updateStage()`, `updateInfo()`, `deletePlanting()` |
| `ActionsRepository` | `getActions(plantingId?)`, `createAction()` |
| `HarvestRepository` | `getHarvests()`, `addHarvest()` |
| `RecommendationsRepository` | `getRecommendations()` |
| `CalendarRepository` | `getCalendarData()` |
| `AnalyticsRepository` | `getSummary()`, `exportActionsIntent()` |

### Enum-значения в БД
```
action_type:    watering | fertilizing | treatment | other
planting.stage: sowing | sprouted | growing | flowering | harvesting | done
conditions:     soil | greenhouse
```

### Паттерны кода
- ViewModel → `StateFlow<UiState>` (sealed class: Loading / Success / Error)
- Repository → `Result<T>` (sealed: Success / Error / Loading)  
- `runCatching` в UI только для парсинга дат (иначе — явный sealed)
- Injection через Hilt + `@Singleton` репозитории

---

## База данных

### Миграции
| Файл | Содержание |
|------|-----------|
| 001 | Базовые таблицы: users, gardens, crops, plantings, action_logs, reminders, weather_snapshots, recommendations, harvests |
| 002 | Расширения crops: frost_sensitive, harvest_days |
| 003 | push_tokens (RuStore) |
| 004 | UNIQUE(crops.name) — дедупликация справочника |
| 005 | Расширение crops v2: climate_zones, watering_details, diseases, pests, neighbors |
| 006 | Seed 50 культур: полная агрономическая база знаний |
| 007 | plantings: quantity INT, conditions VARCHAR(20) |
| 008 | care_tasks (плановые задачи) |
| 009 | care_alert_log (дедупликация пушей полива/подкормки) |

### Ключевые таблицы
- `crops.climate_zones` — JSONB, USDA зоны 3–6 (сроки посева по зоне)
- `crops.watering_details` — JSONB: `{ frequency_days, notes }`
- `crops.fertilizing_schedule` — JSONB: массив этапов
- `crops.diseases`, `crops.pests` — JSONB
- `crops.good_neighbors`, `crops.bad_neighbors` — TEXT[] по имени
- `gardens.climate_zone` — fallback через `getZoneForRegion(region)` если не задано явно

---

## Инфраструктура

| Параметр | Значение |
|----------|---------|
| VPS | Hetzner, IP 78.47.58.211 |
| API URL | https://dacha.studio1008.com/ |
| Порт | 3002 |
| PM2 процесс | `dacha-api` |
| nginx | `/etc/nginx/sites-available/dacha` |
| SSL | Let's Encrypt, истекает ~2026-08-27 |
| БД | PostgreSQL, `dacha_db`, пользователь `dacha_user` |
| SSH | Только из PowerShell (Windows SSH-ключ) |

---

## Известные ограничения

- **Android unit tests**: `ClassNotFoundException` при запуске `./gradlew test` из-за кирилицы в пути проекта (`Календарь дачника`) + AGP 9 + Windows. Тесты компилируются корректно, но worker JVM не может загрузить классы из пути с кириллицей. Обходной путь: запускать тесты из Android Studio или переместить проект в путь без кириллицы.
- **Open-Meteo**: иногда недоступен с VPS (таймаут/502), данные погоды могут быть устаревшими.
- **RuStore Push**: требует точного совпадения package name `ru.dachakalend.app` (без `.debug` суффикса).
