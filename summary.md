# Архитектурный статус и прогресс MVP: "Календарь дачника"

## Назначение документа
Фиксация глобального прогресса по разработке MVP (5 запланированных спринтов) и актуального состояния кодовой базы.

## Текущий статус MVP
- **Общий прогресс**: 80% (Спринты 1–3 завершены)
- **Текущий спринт**: Спринт 4 — Погода и уведомления
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
- [ ] Подключение погодного API и фоновый джоб кэширования (`WeatherSnapshot`)
- [ ] Логика трёхслойных рекомендаций — протестировать (реализована в `/recommendations`)
- [ ] Настройка push-инфраструктуры (RuStore Push SDK)
- **Статус**: 🔴 Не начат

### Спринт 5. Урожай и бета (Длительность: 1 неделя)
*Результат: Сбор фидбэка, аналитика закрытого релиза.*
- [ ] Модуль ввода и отображения урожая (`Harvest`) — эндпоинты готовы, нужен Android UI
- [ ] Экспорт истории действий и базовая аналитика продуктовых метрик (Retention, Онбординг)
- **Статус**: 🔴 Не начат

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
