# Протокол рабочей сессии разработчика

**Дата сессии**: 2026-05-27  
**Текущий контекст**: Сессия 1 — Инициализация проекта, настройка окружения

## 1. Что было сделано за сессию
- Определён технический стек: Node.js 20 + Fastify + PostgreSQL
- Создана полная структура backend-проекта в `backend/`
- Реализованы все роуты MVP: auth, gardens, crops, plantings, actions, weather, recommendations, reminders, harvests
- Написана логика трёхслойных рекомендаций (Культура + Погода + Стадия)
- Созданы SQL-миграции для всех 9 сущностей + seed базового справочника культур (21 позиция)
- Настроены конфиги деплоя: `ecosystem.config.js` (pm2), `nginx.conf.example`, `scripts/deploy.sh`

## 2. Технические решения и нюансы
- Порт **3002** — чтобы не конфликтовать с `landing-admin` (порт 3001) на том же VPS
- PostgreSQL нужно **установить на VPS** (`apt install postgresql`)
- `.env.example` содержит все необходимые переменные — скопировать в `.env` на сервере
- Справочник культур (`crops`) — публичный (без авторизации), посадки (`plantings`) — приватные
- Погода кэшируется в `weather_snapshots`, кэш считается свежим 3 часа
- Рекомендации генерируются on-demand при GET-запросе и сохраняются в БД

## 3. Архитектурные решения сессии
- Сущность `Recommendation`: генерация через `/recommendations?garden_id=` на основе трёх слоёв
- Сущность `ActionLog`: тип действия — `watered | fertilized | treated | transplanted | other`
- Сущность `Planting`: стадия — `sowing | sprouted | growing | flowering | harvesting | done`

## 4. Итог сессии — деплой завершён ✅
- Репозиторий: https://github.com/eugenekrukov/dacha.git (ветка main)
- VPS: 78.47.58.211, API доступен по `http://78.47.58.211/dacha/`
- pm2 процесс: `dacha-api`, порт 3002
- nginx: location `/dacha/` проксирует на 127.0.0.1:3002 в `/etc/nginx/sites-available/default`
- Health check: `http://78.47.58.211/dacha/health` → 200 OK

## 5. План на следующую сессию (Next Steps)
- [x] Протестировать авторизацию end-to-end: `POST /dacha/auth/register` → `POST /dacha/auth/login` ✅
- [ ] Спринт 2: добавить агрегирующий эндпоинт `GET /today?garden_id=` (топ задач дня)
- [ ] Настроить деплой-скрипт `scripts/deploy.sh` для последующих обновлений
- [ ] Добавить `fastify-plugin` как зависимость в package.json (нужен для `src/plugins/db.js`)

---

## Сессия 2 — 2026-05-27: Закрытие Спринта 1

### Что сделано
- Протестирована авторизация end-to-end:
  - `GET /dacha/health` → 200 OK ✅
  - `POST /dacha/auth/register` → токен + объект user ✅
  - `POST /dacha/auth/login` → токен + объект user ✅
  - `GET /dacha/auth/me` (с Bearer токеном) → полный профиль пользователя с `notification_settings` ✅
- Спринт 1 закрыт, прогресс обновлён до 20%
- Текущий активный спринт: **Спринт 2 — Главная и календарь**

---

## Сессия 3 — 2026-05-27: Спринт 2 — GET /today

### Что сделано
- Создан `backend/src/routes/today.js` — агрегирующий эндпоинт экрана «Сегодня»
- Логика: 4 типа задач с приоритетами — frost_alert (1) → transplant_due (2) → watering_due (3) → harvest_due (4) → reminder (5)
- Топ-5 задач, сортировка по приоритету и просроченности
- Зарегистрирован в `app.js` (`prefix: '/today'`)
- Задеплоен на VPS, протестирован: томат 30 дней без полива → задача `watering_due` ✅
- Прогресс обновлён до 28%

### Следующий шаг Спринта 2
- [ ] Экран «Сегодня» — Android UI (Погода + задачи + быстрые кнопки)
- [ ] Календарь работ (месячный/дневной вид)

---

---

## Сессия 4 — 2026-05-28: Android-структура проекта

### Что сделано
- Восстановлен сломанный `backend/src/app.js` (файл был обрезан на `} catch (err`), задеплоен на VPS
- Создан Android-проект `android/` на стеке: **Kotlin + Jetpack Compose + Hilt + Retrofit**
- Gradle Version Catalog (`libs.versions.toml`): AGP 8.3.2, Kotlin 1.9.23, Compose BOM 2024.05
- **Data-слой**: `DachaApi` (Retrofit), `AuthInterceptor`, `TokenStorage`, `TodayRepository`, `NetworkModule` (Hilt)
- **UI-слой**: `DachaCalendarTheme` (зелёная палитра, цвета по типу задачи), `TodayViewModel` (StateFlow), `TodayScreen` (Compose) — погода, карточки задач, быстрые кнопки
- `MainActivity` с `BottomNavigation`: Сегодня / Календарь / Посадки / Урожай
- Заглушки для CalendarScreen, PlantingsScreen, HarvestScreen

### Ключевые параметры
- Package: `ru.dachakalend.app` | minSdk: 26 | targetSdk: 34
- `BASE_URL` прописан в `buildConfigField` → `http://78.47.58.211/dacha/`
- Токен хранится в `SharedPreferences` через `TokenStorage`

### Следующий шаг — Спринт 3
- Android UI: справочник культур и карточка посадки (`Crop`, `Planting`)
- Журнал действий в 2-3 тапа (`ActionLog`)
- Механизм локальных напоминаний (`Reminder`)
- Запустить на эмуляторе / устройстве и проверить онбординг end-to-end

---

## Сессия 5 — 2026-05-28: Онбординг

### Что сделано
- `AuthRepository` — логин/регистрация, сохранение JWT в SharedPreferences
- `GardenRepository` — создание участка, сохранение `garden_id`
- `LoginScreen` + `RegisterScreen` + `AuthViewModel`
- `CreateGardenScreen` + `GardenViewModel` (dropdown регионов РФ)
- `MainActivity` определяет стартовый экран по токену и `garden_id`
- Флоу: нет токена → Login → Register → CreateGarden → TodayScreen
- Билд успешен, предупреждения компилятора устранены (KSP, `@OptIn`, `@field:Json`, `-Xannotation-default-target`)

### Осталось в Спринте 2
- ✅ Всё закрыто. Спринт 2 завершён.

---

---

## Сессия 6 — 2026-05-28: HTTPS, отладка на устройстве

### Что сделано
- Настроен HTTPS для бэкенда: поддомен `dacha.studio1008.com` → A-запись → Let's Encrypt сертификат → nginx reverse proxy на порт 3002
- `BASE_URL` в `build.gradle.kts` переключён с `http://78.47.58.211/dacha/` на `https://dacha.studio1008.com/`
- `network_security_config.xml`: убрано временное разрешение cleartext для IP, остался только `base-config cleartextTrafficPermitted="false"`
- Приложение успешно запущено на реальном устройстве Samsung SM-A556E через ADB

### Исправленные баги
1. **CLEARTEXT error** — Android 9+ блокирует HTTP. Решение: HTTPS + обновлён `network_security_config.xml`
2. **500 при создании участка** — колонки `lat`/`lon` в таблице `gardens` были NOT NULL. Решение: `ALTER TABLE gardens ALTER COLUMN lat DROP NOT NULL` + аналогично для `lon`; роут обновлён (`?? null`)
3. **"Required value 'gardenId' missing"** — несовпадение структуры ответа `/today` с Android-моделью. Решение: поля `TodayResponse` сделаны nullable с дефолтами; ответ бэкенда приведён к формату `{garden_id, tasks[{title, description}], weather, generated_at}`

### Текущее состояние инфраструктуры
- nginx конфиг: `/etc/nginx/sites-available/dacha` (certbot управляет SSL)
- Сертификат: `/etc/letsencrypt/live/dacha.studio1008.com/` (действителен до ~2026-08-27)
- Health check: `https://dacha.studio1008.com/health` → `{"status":"ok"}`
- Онбординг работает end-to-end: регистрация → создание участка → экран «Сегодня»

### Следующие шаги — Спринт 3
- Android UI: справочник культур и карточка посадки (`Crop`, `Planting`)
- Журнал действий в 2-3 тапа (`ActionLog`)
- Механизм локальных напоминаний (`Reminder`)

---

## 6. Команды для деплоя обновлений
```bash
# На VPS — обновить код
cd /var/www/dacha-api
git pull origin main
cd backend && npm install
pm2 reload dacha-api
```

---

## Сессия 3 — 2026-05-28: Спринт 3 — Культуры и журнал

### Что сделано
- **Модели** (`Models.kt`): добавлены `Crop`, `ActionLog`, `CreatePlantingRequest`, `CreateActionRequest`, `CreateReminderRequest`
- **DachaApi**: расширен — `getCrops`, `getCrop`, `createPlanting`, `updatePlantingStage`, `getActions`, `createAction`, `createReminder`
- **Репозитории**: `CropsRepository`, `PlantingsRepository` (с createPlanting + updateStage), `ActionsRepository`, `ReminderRepository`
- **UI культур**: `CropsScreen` (фильтр по категориям), `CropDetailScreen` (детали + кнопка «Посадить»), `CropsViewModel`
- **UI посадок**: `PlantingsScreen` (список посадок, переход стадий), `PlantingsViewModel`
- **Журнал действий**: `ActionLogBottomSheet` (4 типа действий в 2 тапа), `ActionLogViewModel`
- **Напоминания**: `ReminderWorker` (HiltWorker), `ReminderScheduler` (WorkManager), `NotificationHelper` (канал уведомлений)
- **WorkManager**: подключён в `build.gradle.kts`, отключён auto-init в `AndroidManifest.xml`, `App.kt` реализует `Configuration.Provider`
- **Навигация**: добавлены маршруты `Screen.Crops` и `Screen.CropDetail`, подключены в `MainActivity`

### Следующий спринт (4)
- Подключение погодного API (Open-Meteo или аналог без ключа)
- Фоновый джоб кэширования WeatherSnapshot
- Тест трёхслойных рекомендаций end-to-end
- RuStore Push SDK — push-инфраструктура

### Git
```
git add -A
git commit -m "feat(sprint3): crops UI, action log, local reminders (WorkManager)"
git push origin feature/sprint3-crops-journal
```

---

---

## Сессия 7 — 2026-05-29: Спринт 4 — Погодный джоб (бэкенд)

### Что сделано
- Добавлены зависимости `node-cron ^3.0.3` и `node-fetch ^2.7.0` в `backend/package.json`
- Создан `backend/src/services/weatherService.js` — интеграция с **Open-Meteo** (бесплатный API, без ключа):
  - `fetchWeatherData(lat, lon)` → текущая температура, мин/макс, влажность, скорость ветра, осадки, WMO код погоды
  - Нормализация: `condition` (clear/cloudy/rain/snow/storm), `condition_text` (русский текст по WMO), `frost_risk` (≤2°C), `heat_risk` (≥35°C)
  - `updateGardenWeather(db, garden)` — пропускает, если кэш свежее 3 часов
- Создан `backend/src/jobs/weatherJob.js` — `node-cron` расписание `0 */3 * * *`:
  - Обходит все участки с координатами
  - Запускается сразу при старте (без ожидания первых 3 часов)
  - Обработка ошибок per-garden (один сбой не ломает весь джоб)
- Обновлён `backend/src/app.js` — джоб регистрируется в хуке `onReady` (после инициализации БД)
- Исправлен `backend/src/routes/today.js` — поля погоды приведены к реальной схеме:
  - `weather.feels_like_c` → `weather.max_temp_c`
  - `weather.humidity` → `weather.humidity_pct`
  - Добавлены `condition_text`, `heat_risk`, `temp_c`

### Для деплоя
```bash
# Локально
git add src/services/weatherService.js src/jobs/weatherJob.js src/app.js src/routes/today.js package.json
git commit -m "feat(weather): Open-Meteo integration + 3h cron job"
git push origin main

# На VPS
cd /var/www/dacha-api && bash scripts/deploy.sh
```

### Проверка после деплоя
- `pm2 logs dacha-api` — ожидать `[weather-job] Garden N: обновлено — X°C, ...`
- `GET /weather?garden_id=1` с токеном — должен вернуть реальные данные
- `GET /recommendations?garden_id=1` — рекомендации с погодным слоем (frost_alert при t≤2°C)

### Следующие шаги Спринта 4
- [x] Android: WeatherRepository + модель WeatherSnapshot → реальные данные на TodayScreen ✅
- [x] Android: RecommendationsRepository + карточки рекомендаций ✅
- [ ] Push: RuStore Push SDK + PushService.kt + серверный endpoint для push-токена

---

## Сессия 8 — 2026-05-29: Спринт 4 — Android-часть + совместимость AGP 9

### Что сделано
- `WeatherSummary` обновлена: `tempC`, `conditionText`, `heatRisk`; новые модели `WeatherSnapshot`, `Recommendation`
- `DachaApi`: `getWeather`, `getRecommendations`; `WeatherRepository`, `RecommendationsRepository`
- `TodayViewModel`: параллельная загрузка `/today` + `/recommendations` через `async`
- `TodayScreen`: улучшен `WeatherCard`, добавлены `RecommendationCard`
- `today.js`: `parseFloat()` для температур (Postgres DECIMAL → строка)
- `regionCoords.js`: координаты центров областей РФ для участков без GPS

### Совместимость AGP 9 / Kotlin 2.3.21
- Убран плагин `kotlin.android` (AGP 9.0+ встроил Kotlin)
- Hilt обновлён до **2.59.2** (2.56.x несовместим с AGP 9, `BaseExtension` удалён)
- KSP: новое версионирование `2.3.9` (не `kotlinVersion-kspBuildVersion`)
- `@field:Json` → `@Json` во всех моделях (Kotlin 2.3+ без `-Xannotation-default-target`)

### Следующая сессия — Push (финал Спринта 4)
- RuStore Push SDK: зарегистрировать приложение, добавить SDK
- `PushService.kt` — обработчик входящих пушей
- Бэкенд: таблица `push_tokens`, `POST /push-tokens`, триггер при `frost_alert`

---

## Сессия 9 — 2026-05-29: Спринт 5 — Модуль урожая (Android)

### Что сделано
- **`Models.kt`**: добавлены `Harvest` и `CreateHarvestRequest` с `@JsonClass`/`@Json`
- **`DachaApi.kt`**: добавлены `getHarvests(gardenId?)` и `createHarvest(request)`
- **`HarvestRepository.kt`**: `getHarvests(gardenId?)` и `addHarvest(plantingId, weightKg, quantity, notes)` — паттерн `Result<T>`, `@Singleton`
- **`HarvestViewModel.kt`**: параллельная загрузка урожаев + посадок, `openAddSheet / closeAddSheet`, `addHarvest`, `clearMessage`
- **`HarvestScreen.kt`**: полноценный экран с:
  - `HarvestSummaryCard` — итоговые цифры (всего кг / штук / записей) в `primaryContainer`
  - `HarvestCard` — карточка записи (культура, вес/кол-во/заметка, дата)
  - `EmptyHarvestState` — пустой стейт с подсказкой
  - `AddHarvestSheet` — BottomSheet: выбор посадки (ExposedDropdownMenu), ввод веса + штук (2 поля в ряд), заметка, кнопка "Сохранить" с индикатором загрузки
- Экран уже подключён в `MainActivity` через `composable(Screen.Harvest.route) { HarvestScreen() }`

### Git
```
git checkout -b feature/sprint5-harvest
git add -A
git commit -m "feat(sprint5): Harvest module — model, repository, ViewModel, full UI"
git push origin feature/sprint5-harvest
```

---

## Сессия 10 — 2026-05-29: Спринт 4 финал — Push-инфраструктура

### Что сделано

**Backend:**
- `003_push_tokens.sql` — таблица `push_tokens(id, user_id, token, platform, created_at, updated_at)`, UNIQUE(user_id, token)
- `routes/push-tokens.js` — `POST /push-tokens` (upsert токена), `DELETE /push-tokens` (удаление при выходе)
- `services/pushService.js` — `sendPush(token, title, body, data)` через RuStore Push API, `sendFrostAlert(db, gardenId, tempC)` — рассылка всем устройствам участка
- `jobs/weatherJob.js` — после обновления погоды вызывает `sendFrostAlert` если `frost_risk = true`
- `.env.example` — добавлены `RUSTORE_PUSH_PROJECT_ID` и `RUSTORE_PUSH_SERVICE_TOKEN`

**Android:**
- `settings.gradle.kts` — добавлен maven `artifactory-external.vkpartner.ru`
- `libs.versions.toml` — `rustorePush = "6.0.0"`, lib `rustore-push`
- `app/build.gradle.kts` — `implementation(libs.rustore.push)`, `buildConfigField RUSTORE_PUSH_PROJECT_ID`
- `DachaPushService.kt` — `@AndroidEntryPoint`, наследник `RuStoreMessagingService`: `onNewToken` → POST `/push-tokens`; `onMessageReceived` → показ data-only пушей через `NotificationHelper`
- `App.kt` — `RuStorePushClient.init(projectId = BuildConfig.RUSTORE_PUSH_PROJECT_ID)`
- `AndroidManifest.xml` — `<service>` для `DachaPushService` + `<meta-data>` канала `dacha_reminders`
- `DachaApi.kt` — `registerPushToken` и `deletePushToken`

### Что нужно сделать вручную перед деплоем
1. В [RuStore Консоль](https://console.rustore.ru) → Push-уведомления → Проекты → создать проект для `ru.dachakalend.app`
2. Скопировать **ID проекта** → вставить в `app/build.gradle.kts` в `RUSTORE_PUSH_PROJECT_ID`
3. Скопировать **Сервисный токен** → добавить в `.env` на VPS: `RUSTORE_PUSH_SERVICE_TOKEN=...`
4. Запустить миграцию на VPS: `psql $DATABASE_URL -f backend/src/db/migrations/003_push_tokens.sql`
5. `pm2 reload dacha-api`

### Git
```
git checkout -b feature/sprint4-push
git add -A
git commit -m "feat(sprint4): RuStore Push SDK — DachaPushService, push-tokens endpoint, frost_alert push"
git push origin feature/sprint4-push
```

---

## Сессия 11 — 2026-05-30: Push end-to-end тест + фиксы

### Что сделано
- Исправлен endpoint в `pushService.js`: `/send` → `/messages:send` (правильный RuStore API)
- `POST /actions`: бэкенд теперь принимает оба поля — `action_type` и `type`
- `POST /gardens`: сразу запускает `updateGardenWeather` для нового участка
- Push протестирован end-to-end: токен регистрируется → `{}` от RuStore → уведомление на устройстве ✅
- Убран `applicationIdSuffix = ".debug"` — package name теперь `ru.dachakalend.app` (требование RuStore Push)
- Выданы права `dacha_user` на таблицу `push_tokens`
- Убран дубль `RUSTORE_PUSH_SERVICE_TOKEN` из `.env`
- `TodayViewModel`: явный вызов `RuStorePushClient.getToken()` при каждом старте экрана

### Git
```
git add -A
git commit -m "fix: push endpoint, action_type field, weather on garden create"
git push origin main
```

---

## Процесс завершения сессии (обязательно)

В конце каждой сессии Claude обязан:
1. Обновить `summary.md` — прогресс спринта, статус
2. Дописать лог в `session-note.md`
3. **Актуализировать `android/CONVENTIONS.md`** — если добавились новые репозитории, методы, паттерны или соглашения

---

## Сессия 12 — 2026-05-30: Спринт 5 завершён — аналитика и экспорт

### Что сделано
- `GET /actions/export` — бэкенд отдаёт CSV с BOM (Excel-совместимый), столбцы: дата, культура, действие, заметки
- `GET /analytics/summary` — бэкенд: streak, total_actions, total_harvests, activity_by_day (30 дней), onboarding-прогресс
- `analytics.js` зарегистрирован в `app.js` с префиксом `/analytics`
- Модели `AnalyticsSummary`, `ActivityDay`, `OnboardingProgress` добавлены в `Models.kt`
- `DachaApi`: `getAnalyticsSummary()`, `exportActions()` (возвращает `ResponseBody`)
- `AnalyticsRepository`: `getSummary()` + `exportActionsIntent()` (FileProvider → Share chooser)
- `FileProvider` добавлен в `AndroidManifest.xml`, создан `res/xml/file_paths.xml` (cache-path)
- `AnalyticsViewModel` + `AnalyticsScreen` (StatCard, OnboardingCard, ActivityChart, кнопка экспорта)
- `Screen.Analytics` добавлен в навигацию, иконка `BarChart` в BottomNav
- `CONVENTIONS.md` обновлён: AnalyticsRepository, история изменений
- `summary.md`: Спринт 5 ✅, прогресс → 100% MVP

### Git
```
git add -A
git commit -m "feat(sprint5): analytics screen + CSV export — MVP complete"
git push origin feature/sprint5-analytics-export
# После проверки билда:
git checkout main
git merge --squash feature/sprint5-analytics-export
git commit -m "feat(sprint5): analytics screen + CSV export — MVP complete"
git push origin main
git branch -d feature/sprint5-analytics-export
git push origin --delete feature/sprint5-analytics-export
```
