# Архитектурный статус и прогресс MVP: "Календарь дачника"

## Назначение документа
Фиксация глобального прогресса по разработке MVP (5 запланированных спринтов) и актуального состояния кодовой базы.

## Текущий статус MVP
- **Общий прогресс**: 100% MVP завершён ✅ (все 5 спринтов)
- **Текущий спринт**: MVP завершён → следующий этап: тесты
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL | Android (Kotlin + Compose + Hilt)
- **VPS порт**: 3002 | pm2 процесс: `dacha-api`
- **Бэкенд URL**: `https://dacha.studio1008.com/` (HTTPS, nginx + Let's Encrypt)

---

## Статус реализации спринтов

### Спринт 1. Каркас продукта (Длительность: 1 неделя)
*Результат: Базовая навигация, авторизация, создание участка.*
- [x] Структура backend-проекта (Fastify + PostgreSQL)
- [x] Все API-роуты MVP (`/auth`, `/gardens`, `/crops`, `/plantings`, `/actions`, `/weather`, `/recommendations`, `/reminders`, `/harvests`)
- [x] SQL-миграции всех 9 сущностей + seed справочника культур
- [x] Конфиги деплоя (pm2 ecosystem, nginx, deploy.sh)
- [x] Подключение GitHub репозитория и первый push
- [x] Деплой на VPS + применение миграций (https://dacha.studio1008.com/)
- [x] Протестировать авторизацию end-to-end
- **Статус**: ✅ Завершён

### Спринт 2. Главная и календарь (Длительность: 1 неделя)
*Результат: Экран "Сегодня" и календарная сетка.*
- [x] Агрегирующий эндпоинт `GET /today?garden_id=` (топ задач дня)
- [x] Экран "Сегодня" — Android UI (TodayScreen, TodayViewModel, data-слой, тема)
- [x] Онбординг — LoginScreen, RegisterScreen, CreateGardenScreen, роутинг по токену
- [x] Календарь работ — месячный грид, маркеры событий, дневной вид
- **Статус**: ✅ Завершён

### Спринт 3. Культуры и журнал (Длительность: 1 неделя)
*Результат: Ведение посадок и логирование активности.*
- [x] Android UI: справочник культур и карточка посадки (`CropsScreen`, `CropDetailScreen`, `PlantingsScreen`, `PlantingsViewModel`, `CropsViewModel`)
- [x] Журнал действий в 2-3 тапа (`ActionLogBottomSheet`, `ActionLogViewModel`, `ActionsRepository`)
- [x] Механизм локальных напоминаний (`ReminderWorker`, `ReminderScheduler`, WorkManager + HiltWorkerFactory)
- [x] Модели: `Crop`, `ActionLog`, `CreatePlantingRequest`, `CreateActionRequest`, `CreateReminderRequest`
- [x] API: getCrops, getCrop, createPlanting, updateStage, getActions, createAction, createReminder
- **Статус**: ✅ Завершён

### Спринт 4. Погода и уведомления (Длительность: 1 неделя)
*Результат: Интеграция внешних данных и доставка пушей.*
- [x] Подключение погодного API (Open-Meteo) + фоновый джоб кэширования (`weatherJob.js`, `node-cron`, каждые 3 часа)
- [x] Исправлен `today.js` — поля погоды приведены к реальной схеме БД, температуры приводятся к Float
- [x] Деплой на VPS + верификация `/weather` и `/recommendations` с реальными данными ✅
- [x] Android: `WeatherRepository`, `RecommendationsRepository`, реальная погода + рекомендации на `TodayScreen` ✅
- [x] Фикс совместимости: AGP 9.x (убран `kotlin.android` плагин), Hilt 2.59.2, `@Json` вместо `@field:Json` для Moshi KSP
- [x] Push-инфраструктура: RuStore Push SDK 6.0.0 + `DachaPushService` + `POST /push-tokens` + `pushService.js` (frost_alert) — протестировано end-to-end ✅
- [x] Фикс `POST /actions`: бэкенд принимает и `type` и `action_type`
- [x] Погода создаётся сразу при создании участка (не ждёт 3-часового цикла)
- **Статус**: ✅ Завершён

### После MVP (технический долг)
- [ ] **Геокодирование по населённому пункту** — в онбординге добавить поле "Ваш город/посёлок" и геокодировать через [DaData](https://dadata.ru/api/suggest/address/) (10 000 запросов/день бесплатно) или Nominatim/OSM (без ключа, 1 req/s). Яндекс Геокодер не подходит для prod — лимит 1000 req/day на бесплатном тарифе.

### Спринт 5. Урожай и бета (Длительность: 1 неделя)
*Результат: Сбор фидбэка, аналитика закрытого релиза.*
- [x] Модуль ввода и отображения урожая (`Harvest`) — модели, `HarvestRepository`, `HarvestViewModel`, `HarvestScreen` (список + сводная карточка + BottomSheet добавления)
- [x] Экспорт истории действий (`GET /actions/export` CSV + Share sheet) и экран аналитики (`AnalyticsScreen` — streak, счётчики, онбординг-прогресс, график активности)
- **Статус**: ✅ Завершён

---

## Реализованные API Эндпоинты
- [x] `POST /auth/register` | `POST /auth/login` | `GET /auth/me`
- [x] `POST /gardens` | `GET /gardens` | `GET /gardens/:id` | `PUT /gardens/:id`
- [x] `GET /crops` | `GET /crops/:id` | `POST /crops`
- [x] `POST /plantings` | `GET /plantings` | `GET /plantings/:id` | `PATCH /plantings/:id/stage`
- [x] `POST /actions` | `GET /actions?planting_id=`
- [x] `GET /weather?garden_id=`
- [x] `GET /recommendations?garden_id=`
- [x] `POST /reminders` | `GET /reminders`
- [x] `GET /harvests` | `POST /harvests`

## Структура проекта
```
android/
├── gradle/libs.versions.toml   # Version catalog (AGP 8.3, Kotlin 1.9, Compose BOM 2024.05)
├── app/
│   ├── build.gradle.kts        # compileSdk 34, minSdk 26, buildConfig BASE_URL
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/ru/dachakalend/app/
│           ├── App.kt              # @HiltAndroidApp
│           ├── MainActivity.kt     # BottomNav + NavHost (4 вкладки)
│           ├── navigation/         # Screen sealed class, bottomNavItems
│           ├── data/
│           │   ├── api/            # DachaApi (Retrofit), AuthInterceptor
│           │   ├── model/          # Models.kt (TodayResponse, TodayTask, WeatherSummary, Garden...)
│           │   ├── local/          # TokenStorage (SharedPreferences)
│           │   └── repository/     # TodayRepository + sealed Result<T>
│           ├── di/                 # NetworkModule (Hilt)
│           └── ui/
│               ├── theme/          # DachaCalendarTheme, taskColor()
│               ├── today/          # TodayScreen + TodayViewModel
│               ├── calendar/       # заглушка (Спринт 2)
│               ├── plantings/      # заглушка (Спринт 3)
│               └── harvest/        # заглушка (Спринт 5)

backend/
├── src/
│   ├── app.js                  # точка входа Fastify
│   ├── plugins/db.js           # PostgreSQL pool
│   ├── routes/                 # все API-роуты
│   └── db/
│       ├── migrate.js          # runner миграций
│       └── migrations/
│           ├── 001_init.sql    # схема всех таблиц
│           └── 002_seed_crops.sql
├── scripts/deploy.sh
├── ecosystem.config.js         # pm2 конфиг
├── nginx.conf.example
├── .env.example
└── package.json
```
