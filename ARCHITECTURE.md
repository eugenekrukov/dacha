# Архитектура: Календарь дачника

## Стек технологий

| Слой | Технологии |
|------|-----------|
| **Backend** | Node.js 20, Fastify 4, PostgreSQL, node-cron, node-fetch; ЮKassa (биллинг), Brevo HTTP API (почта), firebase-admin (FCM), Anthropic Claude (не задействован в проде) |
| **Web** | React 18 + Vite + TypeScript + Tailwind (папка `web/`), та же БД/API; прод `https://dacha.studio1008.com/app/` (статика `/var/www/dacha-web`, nginx `location /app/`) |
| **Android** | Kotlin, Jetpack Compose, Hilt (DI), Retrofit + Moshi, WorkManager, Coil; флейворы `rustore`/`gplay`/`samsung`; пуши RuStore Push (rustore) / FCM (gplay/samsung); реклама Yandex Mobile Ads (samsung); minSdk 26, target/compileSdk 36 |
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
│   ├── auth.js          — register/login/me, verify/reset email, П4 (password/change-email/confirm/DELETE me)
│   ├── billing.js       — ЮKassa: create-payment, webhook, cancel-autorenew, return
│   ├── promo.js         — POST /promo/redeem (промокоды)
│   ├── guide.js         — справочник проблем растений (дефициты/болезни/вредители)
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
├── services/emailService.js — почта (Brevo HTTP API; SMTP режется Hetzner)
├── services/yookassaService.js — ЮKassa (createPayment/getPayment/buildReceipt)
├── jobs/renewalJob.js     — cron 10:00, продление подписок (no-op при разовой оплате)
└── db/
    └── migrations/          — SQL миграции 001–036
```

### API эндпоинты
```
# auth
POST /auth/register       POST /auth/login         GET /auth/me
POST /auth/subscription   (RuStore-синк, депрекейтится)
POST /auth/verify-email   POST /auth/resend-verification
POST /auth/forgot-password POST /auth/reset-password
PATCH /auth/password      (смена пароля — П4)
POST /auth/change-email   POST /auth/confirm-email-change   (смена email verify-first — П4)
DELETE /auth/me           (удаление аккаунта: hard delete + анонимизация payments — П4)
# billing / promo (ЮKassa)
POST /billing/create-payment   POST /billing/webhook   POST /billing/cancel-autorenew   GET /billing/return
POST /promo/redeem
# домены
POST /gardens             GET /gardens             GET /gardens/:id     PUT /gardens/:id
GET /crops                GET /crops/:id           POST /crops          PUT /crops/:id
GET /guide                GET /guide/:slug         POST/PUT /guide (requireAdmin)   # справочник проблем
POST /plantings           GET /plantings           GET /plantings/:id
  PATCH /plantings/:id/stage    PATCH /plantings/:id/info    DELETE /plantings/:id
POST /actions             GET /actions             GET /actions/export   DELETE /actions/:id
GET /weather?garden_id=   GET /geocode/suggest?q=
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
4. `harvest_due` (урожай готов; cooldown 3 дня после последней записи в `harvests` по этой посадке)
5. `reminder` (ручное напоминание)

### Push-уведомления
| Триггер | Когда | Джоб |
|---------|-------|------|
| `frost_alert` | temperature ≤ 2°C | weatherJob.js |
| `watering_due` | days ≥ wateringFreq | careRemindersJob.js (09:00) |
| `fertilizing_due` | days > 14 | careRemindersJob.js (09:00) |

Дедупликация: `care_alert_log` — не более 1 пуша на посадку/тип/день.

### Деплой
VPS — read-only зеркало `origin/main`, деплой через reset (не `git pull`). SSH только из PowerShell.
```bash
# Бэкенд: /var/www/dacha-api
cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main
cd backend && npm install                       # если менялись зависимости
pm2 restart dacha-api

# Миграции — точечно (полная цепочка падает на 009):
sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/0XX_name.sql

# Веб: cd /var/www/dacha-api/web && npm ci && npm run build
#      && rm -rf /var/www/dacha-web/* && cp -r dist/* /var/www/dacha-web/
```

---

## Android

### Package
`ru.dachakalend.app` · minSdk 26 · target/compileSdk 36 (Android 16) · флейворы `rustore`/`gplay`/`samsung`

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
    ├── harvest/           — HarvestScreen, HarvestViewModel, AddHarvestSheet,
    │                        HarvestLogViewModel, HarvestLogBottomSheet
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
action_type:    watering | fertilizing | treatment | transplanted | other
                + care-типы: thinning | runner_removal | bolt_removal | deflowering | staking
                (action_logs.action_type — VARCHAR(30) без CHECK; маппинг careTaskActionType
                 синхронен в backend todayLogic.js, web api/schedule.ts, Android ActionLogViewModel.kt)
planting.stage: sowing | growing | flowering | harvesting | transplanted | done
                (стадия sprouted удалена; sowing_method = seedling | direct)
conditions:     soil | greenhouse
store:          rustore | gplay | samsung | web   (users.store, модель монетизации)
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
| 010–022 | garden_type, GPS/город, sowing_method, care-тайминги, триал/доступ, промокоды, урожай/yield |
| 023 | email_verification: `users.email_verified` + таблица `email_codes` (коды verify/reset/change_email) |
| 024 | ЮKassa: `payments` + `users.payment_method_id/auto_renew/plan` |
| 025 | `users.store` (модель монетизации по магазину) |
| 026 | `push_tokens.provider` (rustore/fcm) |
| 027 | `crops.is_perennial` (многолетники) |
| 028–033 | справочник проблем: `guide_entries` + `crop_guide_entries`, seed/мердж синонимов, д.в. препаратов |
| 034–035 | `guide_entries.image_url/image_credit` (фото справочника, 52/68) |
| 036 | П4: `users.pending_email` + `payments.user_id` nullable, FK `ON DELETE SET NULL` |

> ⚠️ Полная цепочка `npm run migrate` на проде НЕ идемпотентна (падает на 009 — `must be owner of
> care_alert_log`). Новые миграции применять ТОЧЕЧНО как app-юзер (Node dotenv+pg) или
> `sudo -u postgres psql -d dacha_db -f` для чистых ALTER/UPDATE.

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

- **Android unit tests**: `ClassNotFoundException` при запуске `./gradlew test` — баг тулчейна (AGP 9 + built-in Kotlin не подключает `transformDebugUnitTestClassesWithAsm/dirs` в classpath воркера). Тест-код компилируется; рабочая проверка Android — `:app:compileGplayDebugKotlin`. Логику покрывает backend-сьют. Команда `compileDebugKotlin` без флейвора больше не существует — только `compile{Rustore,Gplay,Samsung}DebugKotlin`.
- **Open-Meteo**: иногда недоступен с VPS (таймаут/502), данные погоды могут быть устаревшими.
- **RuStore Push**: требует точного совпадения package name `ru.dachakalend.app` (без `.debug` суффикса).
