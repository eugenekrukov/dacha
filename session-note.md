# Протокол рабочей сессии разработчика

**Дата последней сессии**: 2026-05-31  

---

## Сессия N — База знаний культур v2

**Дата**: 2026-05-31

### Что сделано
- Добавлена миграция `005_extend_crops_schema.sql` — расширение таблицы `crops` полями: `climate_zones`, `watering_details`, `fertilizing_schedule`, `diseases`, `pests`, `good_neighbors`, `bad_neighbors`, `good_predecessors`
- Написана миграция `006_seed_crops_extended.sql` — данные по ~50 культурам: все существующие 21 обновлены + добавлены 29 новых (тыква, патиссон, капуста цветная/брокколи/пекинская, редька, репа, лук-порей, лук-батун, шпинат, щавель, горох, фасоль, кукуруза, сельдерей, мята, тимьян, смородина, крыжовник, арбуз, дыня, перец острый, хрен, ревень, пастернак)
- Создан справочный документ `docs/crops-knowledge-base.md` с таблицами сроков, совместимости, схемами подкормок

### Технические решения
- Климатические зоны используют USDA зоны 3-6 — соответствует полю `gardens.climate_zone`
- Все новые поля — JSONB, совместимо с существующим паттерном (`notification_settings`)
- `good_neighbors`/`bad_neighbors` — TEXT[] по имени культуры, а не INTEGER[] по id (стабильнее)

### Следующие шаги
- Применить миграции на VPS: `psql ... -f 005_extend_crops_schema.sql` и `006_seed_crops_extended.sql`
- Расширить `GET /crops/:id` — возвращать все новые поля
- Добавить admin-guard на `POST /crops` и новый `PUT /crops/:id`
- Использовать `fertilizing_schedule` в движке рекомендаций

---

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

## Сессия 2026-05-30 — Тесты + баг-фикс посадок

### Что сделано
- Создан `TESTING.md` — полная структура тестов для бэкенда (Vitest + Supertest) и Android (MockK + Turbine). 60+ тест-кейсов по всем модулям MVP.
- Добавлена задача по написанию тестов в `summary.md`.

### Bug fixes
1. **Фильтры культур не работали** — `CROP_CATEGORIES` в `CropsViewModel.kt` содержал неправильные ключи (`vegetables`, `greens`, `berries`, `flowers`), не совпадавшие с БД (`vegetable`, `herb`, `berry`, `flower`). Убрана несуществующая категория `fruits`.
2. **Дублирование культур** — в таблице `crops` отсутствует `UNIQUE(name)`, поэтому `ON CONFLICT DO NOTHING` в seed не срабатывал. Добавлена миграция `004_unique_crops_name.sql` (удаляет дубли, добавляет constraint). В `crops.js` добавлен `DISTINCT ON (name)` как страховка.
3. **Краш при посадке** — `onPlant` в `MainActivity` делал `popUpTo(Crops, inclusive=true)`, после чего `getBackStackEntry(Crops)` бросал `IllegalArgumentException`. Плюс `createPlanting()` вообще не вызывался. Решение: передаём `cropId` через nav argument (`plantings?newCropId={id}`), `PlantingsViewModel` получает его через `SavedStateHandle` и вызывает `createPlanting()` в `init`.

### Файлы изменены
- `android/.../CropsViewModel.kt` — исправлены ключи CROP_CATEGORIES
- `backend/src/routes/crops.js` — добавлен DISTINCT ON (name)
- `backend/src/db/migrations/004_unique_crops_name.sql` — новая миграция
- `android/.../Navigation.kt` — Screen.Plantings добавлен routeWithArgs + withNewCrop()
- `android/.../PlantingsViewModel.kt` — добавлен SavedStateHandle, auto-createPlanting
- `android/.../MainActivity.kt` — исправлен onPlant + добавлен composable для routeWithArgs

### Деплой
```
git checkout -b fix/crops-filter-duplicate-planting
git add -A
git commit -m "fix: crops filter keys, dedup via DISTINCT, planting via nav args"
git push origin fix/crops-filter-duplicate-planting
# На VPS: npm run migrate (004_unique_crops_name.sql)
```

---

## Сессия 2026-05-30 (продолжение) — UI-фиксы

### Что сделано
- `ActionLogBottomSheet`: добавлен `skipPartiallyExpanded = true` — шторка сразу открывается полностью
- `ActionLogBottomSheet`: добавлены `navigationBarsPadding()` + `imePadding()` — кнопка не перекрывается навбаром/клавиатурой
- Зафиксирована задача на быстрые действия в `summary.md`

### На следующую сессию
- Реализовать быстрые действия на экране "Сегодня" (см. summary.md)
- Смержить ветку `fix/crops-filter-duplicate-planting` в `main` после финального тестирования

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
git checkout main
git merge --squash feature/sprint5-analytics-export
git commit -m "feat(sprint5): analytics + CSV export — MVP complete"
git push origin main
# VPS: cd /var/www/dacha-api && git pull origin main && pm2 reload dacha-api ✅
```

### Доп. правка
- Убрана вкладка "Статистика" из BottomNav (`Navigation.kt`) — экран скрыт, маршрут сохранён
- Требует пересборки APK

---

## Сессия 2026-05-31 — Быстрые действия + геокодирование

### Что сделано

**Быстрые действия на TodayScreen:**
- `ActionLogBottomSheet.kt` — добавлен параметр `preselectedType: String? = null`; `selectedType` инициализируется из него
- `TodayViewModel.kt` — добавлены зависимости `PlantingsRepository` и `TokenStorage`; посадки грузятся параллельно с `/today` и `/recommendations`; `TodayScreenData` получил поле `plantings: List<Planting>`
- `TodayScreen.kt`:
  - `TodayContent` получил параметр `plantings`
  - `QuickActionsRow` переработан: принимает `enabled` и `onAction(type)`; кнопки задизейблены если посадок нет, подпись "Добавьте посадку..."
  - Новый composable `PlantingPickerBottomSheet` — список посадок для выбора (показывается если посадок > 1)
  - Логика: 0 посадок → кнопки задизейблены; 1 посадка → сразу открывается ActionLogBottomSheet; > 1 → сначала PlantingPickerBottomSheet

**Геокодирование:**
- `backend/src/routes/gardens.js` — `POST /gardens` и `PUT /gardens/:id` принимают поле `city`; если передан — геокодинг через Nominatim OSM (Node.js 20 native fetch); fallback → regionCoords
- `Models.kt` — `CreateGardenRequest` получил поле `city: String? = null`
- `GardenRepository.kt` — `createGarden(name, region, city?)` передаёт city в запрос
- `GardenViewModel.kt` — `createGarden(name, region, city?)`
- `CreateGardenScreen.kt` — новое поле "Ваш город или посёлок" (опциональное, с подсказкой)

### Git
```
git checkout -b feature/quick-actions-geocoding
git add -A
git commit -m "feat: quick actions on TodayScreen, geocoding via Nominatim in onboarding"
git push origin feature/quick-actions-geocoding
```

---

## Сессия 2026-05-31 — Тесты

### Что сделано

**Рефакторинг для тестируемости:**
- `today.js` — импортирует `buildTasks` / `formatTasks` из `utils/todayLogic.js`; инлайн-логика удалена
- `weatherService.js` — `parseWeatherData(data)` вынесена как отдельная экспортируемая функция; `fetchWeatherData` вызывает её внутри

**Новые файлы:**
- `backend/src/utils/todayLogic.js` — чистые функции `buildTasks` + `formatTasks`, без БД
- `backend/src/__tests__/unit/todayLogic.test.js` — 15 тест-кейсов: заморозки, полив, пересадка, урожай, сортировка, лимит
- `backend/src/__tests__/unit/weatherService.test.js` — 12 тест-кейсов: parseWeatherData + fetchWeatherData с моком node-fetch
- `backend/src/__tests__/helpers/buildApp.js` — фабрика Fastify-инстанса с мок-БД для интеграционных тестов
- `backend/src/__tests__/auth.test.js` — 8 тест-кейсов: register/login/me
- `backend/src/__tests__/today.test.js` — 11 тест-кейсов: /today endpoint end-to-end через supertest
- `android/app/src/test/.../AuthViewModelTest.kt` — 7 тест-кейсов (MockK + Turbine)
- `android/app/src/test/.../TodayViewModelTest.kt` — 5 тест-кейсов
- `android/app/src/test/.../ActionLogViewModelTest.kt` — 4 тест-кейса

**package.json:** добавлены `"test"`, `"test:watch"`, `"test:coverage"` + devDeps: vitest 1.6, supertest 7.0
**build.gradle.kts:** добавлены junit4, coroutines-test, mockk, turbine

### Git
```
git add -A
git commit -m "test: backend unit+integration tests, Android ViewModel tests"
git push origin feature/quick-actions-geocoding
```

### Запуск тестов
```bash
# Бэкенд (локально в папке backend/)
npm install
npm test               # все тесты
npm run test:coverage  # с покрытием

# Android (в Android Studio или терминале)
./gradlew test
```

---

## Сессия 2026-05-31 — Деплой

### Что сделано
- Ветка `feature/quick-actions-geocoding` смержена в `main`
- Бэкенд задеплоен на VPS (`/var/www/dacha-api`), `pm2 reload dacha-api` выполнен
- Конфликты при pull разрешены (`package-lock.json` — theirs, документация — ours)

---

## Сессия 2026-05-31 — CropDetail с посадок + климатическая зона

### Что сделано

**Доступ к карточке культуры с экрана посадок:**
- `PlantingsScreen` — добавлена кнопка "О культуре" в каждой карточке посадки (рядом с "Записать действие")
- `PlantingsScreen` — новый параметр `onCropDetail: (Int) -> Unit`
- `CropsViewModel` — добавлен `loadCropById(cropId)`: загружает культуру напрямую по id без зависимости от стека навигации
- `MainActivity (CropDetail composable)` — переписан: использует собственный `CropsViewModel` + `LaunchedEffect(cropId)`, показывает спиннер во время загрузки. Убрана хрупкая привязка к `getBackStackEntry(Crops)`

**Фильтрация по климатической зоне:**
- `TokenStorage` — добавлены `saveClimateZone` / `getClimateZone`
- `GardenRepository` — при `GET /gardens` сохраняет `climateZone` первого сада
- `CropsRepository` — добавлен `getClimateZone()` (делегирует к TokenStorage)
- `CropsUiState` — новое поле `climateZone: String?`
- `CropDetailScreen / CareTab` — принимают `climateZone`; если зона известна и есть данные — показывается только одна строка "Посев" для нужной зоны; иначе все зоны как раньше
- `backend/src/utils/regionCoords.js` — добавлен `REGION_ZONE` (маппинг регионов → зоны 3–6) и `getZoneForRegion(region)`
- `backend/src/routes/gardens.js` — `GET /gardens` возвращает `climate_zone ?? getZoneForRegion(region)` (fallback для старых записей без зоны); `POST/PUT` сохраняют зону автоматически
- Проверено: Новосибирская область → `climate_zone: "4"` ✅

**Кнопка "Посадить" только в справочнике:**
- `CropDetailScreen.onPlant` — стал nullable; `bottomBar` скрыт когда `onPlant = null`
- `Navigation.kt` — маршрут `CropDetail` получил аргумент `showPlantButton: Boolean`
- С посадок → `showPlantButton=false` (кнопка скрыта); из справочника → `showPlantButton=true`

### Деплой
- `backend/src/routes/gardens.js` и `utils/regionCoords.js` перезаписаны напрямую на VPS (merge повредил файлы)
- `pm2 restart dacha-api` выполнен, API отвечает ✅

### Осталось
- Закоммитить локально (после удаления `.git/index.lock`):
  ```bash
  del "C:\Projects\Dacha\Календарь дачника\.git\index.lock"
  git add -A
  git commit -m "feat: crop detail from plantings, climate zone filter, hide plant button"
  git push origin feature/crop-detail-tabs
  ```

---

## Сессия 2026-05-31 — Параметры посадки + редактирование + рекомендации

### Что сделано

1. **Баг: отображались все регионы в "Сроках посева"**
   - `TokenStorage.kt` был физически обрезан на диске — восстановлен полностью
   - `createGarden()` не сохранял `climateZone` → добавлен `tokenStorage.saveClimateZone(garden.climateZone)`
   - `TodayViewModel.init`: если `climateZone == null` — вызывает `loadGardens()` при старте (для старых пользователей)

2. **Инструкция по записи файлов**: после каждой записи проверять `tail -3` / `wc -c`, что файл не обрезан

3. **Карточка посадки**: дата в формате DD.MM.YY + строка "Дата последнего действия:"
   - Бэкенд: `GET /plantings` возвращает `last_action_at` через подзапрос `MAX(logged_at)`
   - Android: поле `lastActionAt` в `Planting`, функция `formatIsoDate()`

4. **Параметры посадки (quantity, conditions) — полный фича-цикл**:
   - **Миграция** `007_plantings_extra_fields.sql`: `quantity INT DEFAULT 1`, `conditions VARCHAR(20) DEFAULT 'soil'`
   - **Бэкенд `plantings.js`**: POST/GET принимают/возвращают поля; новый `PATCH /:id/info`
   - **Рекомендации**: теплица (`conditions='greenhouse'`) снимает `frost_alert`, увеличивает интервал полива на 30%
   - **`recommendations.js`**: дочинен обрезанный хвост (слой 4 — подкормки)
   - **Android Models**: `Planting` + `quantity`/`conditions`, `CreatePlantingRequest` + поля, новый `UpdatePlantingInfoRequest`
   - **`DachaApi`**: добавлен `updatePlantingInfo PATCH plantings/{id}/info`
   - **`PlantingsRepository`**: добавлен `updateInfo()`
   - **`PlantingsViewModel`**: `pendingCropId` вместо авто-создания, `confirmPlanting()`, `openEditSheet()`, `saveEditedInfo()`
   - **`PlantingsScreen`**: `PlantingSetupBottomSheet` (дата/кол-во/место), `PlantingEditBottomSheet` (редактирование), карточка — "Редактировать информацию" вместо "Следующий этап"

### Важное: Edit tool обрезает файлы на Windows-монтировании!
Все записи файлов теперь только через `cat > file << 'EOF'` в bash. Edit tool использовать нельзя.

### Git
```
git checkout -b feature/planting-setup-conditions
git add -A
git commit -m "feat: planting setup sheet (date/qty/conditions), edit info, greenhouse recommendations"
git push origin feature/planting-setup-conditions
# На VPS:
npm run migrate   # 007_plantings_extra_fields.sql
pm2 restart dacha-api
```
---

## Сессия 2026-05-31 — Баг-фиксы и аудит конвенций

### Что сделано

1. **Admin-guard для справочника культур**
   - Декоратор `requireAdmin` в `app.js` — проверяет `ADMIN_EMAIL` из `.env`
   - `POST /crops` и `PUT /crops/:id` теперь доступны только администратору
   - На VPS добавлен `ADMIN_EMAIL=krukov1@gmail.com` в `.env`

2. **Фикс `action_type` в бэкенде**
   - `today.js` и `recommendations.js` искали `action_type = 'watered'` / `'fertilized'`
   - В БД хранится `'watering'` / `'fertilizing'` (Android пишет именно эти значения)
   - Следствие: `lastWateredMap` всегда был пуст → рекомендации ложно показывали полив для всех посадок
   - Задачи на день при этом могли быть пустыми (корректно для свежих посадок)

3. **Фикс fallback 999 дней в рекомендациях**
   - При отсутствии записи о поливе/подкормке использовался `999` → некорректное сообщение "прошло 999 дн."
   - Заменено на `daysSincePlanting` — реальное время с посадки

4. **Фикс моргания экрана после закрытия шторки "Записать действие"**
   - `PlantingsViewModel.loadPlantings(silent=true)` — не сбрасывает `isLoading` и не очищает список при тихой перезагрузке
   - `closeActionSheet()` теперь вызывает `loadPlantings(silent = true)`

5. **Фикс сортировки расписания работ в PlantingInfoBottomSheet**
   - `expandTasks` сортировал по строке `"dd.MM.yy"` (лексикографически) — неправильно
   - Теперь накапливает `Triple(name, dateStr, LocalDate)`, сортирует по `LocalDate`

6. **Восстановление кодировки UTF-8**
   - PowerShell `Set-Content -Encoding utf8` портит кириллицу (re-encode UTF-8 как Windows-1252)
   - Пострадавшие файлы: `recommendations.js`, `today.js`, `crops.js`, `app.js`
   - Восстановлены через Write tool; правило зафиксировано в CONVENTIONS.md и памяти

7. **Аудит и актуализация `CONVENTIONS.md`**
   - Добавлен `CalendarRepository.getCalendarData()` в таблицу репозиториев
   - Добавлен раздел **5a**: таблица канонических enum-значений в SQL (`watering`, `fertilizing`, `treatment`, `other`, стадии посадки)
   - Уточнено: `runCatching` в UI для парсинга дат — допустимое исключение

### Технические решения
- SSH на VPS работает только из PowerShell (не bash) — Windows SSH-ключ в config
- Бэкенд `.js` писать только через Write tool или SSH heredoc
- `action_type` в БД: `watering | fertilizing | treatment | other` (источник: `ACTION_TYPES` в `ActionLogViewModel.kt`)

### Следующие шаги
- Пересобрать и установить APK с фиксами `action_type`
- Смержить ветку `feature/planting-setup-conditions` в `main` после проверки на устройстве


---

## Сессия 2026-05-31 — GardenEditScreen + Push полив/подкормка

### Что сделано

1. **GardenEditScreen** — экран редактирования участка
   - `UpdateGardenRequest` в Models.kt, `PUT gardens/{id}` в DachaApi
   - `GardenRepository.updateGarden()` + `getCurrentGardenId()`
   - `GardenEditViewModel` (загружает участок, сохраняет через PUT)
   - `GardenEditScreen` — форма с предзаполненными полями (название, город, регион), TopAppBar
   - `Screen.GardenEdit` в Navigation.kt, добавлен в `screensWithoutBottomBar`
   - Кнопка ⚙️ в заголовке TodayScreen → переход на GardenEdit
   - BUILD SUCCESSFUL ✅

2. **Push watering_due / fertilizing_due**
   - `pushService.js`: рефакторинг `getTokensForGarden`, добавлены `sendWateringAlert` и `sendFertilizingAlert`
   - `careRemindersJob.js`: ежедневный cron 09:00 — проверяет все активные посадки, теплица +30% к интервалу, дедупликация
   - `009_care_alert_log.sql`: таблица + индекс для защиты от дублей (1 пуш/посадка/тип/день)
   - `app.js`: `startCareRemindersJob` зарегистрирован в onReady
   - Задеплоено на VPS, логи: `[care-job] Запущен: проверка полива/подкормки каждый день в 09:00` ✅

3. **Гит и деплой**
   - Смержены ветки `feature/planting-setup-conditions`, `feature/garden-edit`, `feature/care-push-notifications` → main
   - `main` синхронизирован с VPS и GitHub

### Технические решения
- Функциональный индекс `(sent_at::date)` в PostgreSQL требует IMMUTABLE — заменён на обычный по `sent_at`
- SSH на VPS: только PowerShell (не bash), миграции через `sudo -u postgres psql -d dacha_db`


---

## Сессия 2026-06-01 — Анализ ТЗ, to-do, технический долг, билд-ревью

### Что сделано

1. **Анализ ТЗ**
   - Прочитан оригинальный PDF с ТЗ
   - Составлена таблица отклонений: что не реализовано, что иначе, что сверх ТЗ
   - Сформирован приоритизированный to-do (17 пунктов, 🔴/🟡/🟢)
   - to-do добавлен в `summary.md`

2. **Технический долг (пп 18–20)**
   - Backend: `npm test` — 55 тестов, 4 файла, все PASSED ✅. Покрытие: auth 100%, todayLogic 100%, today.js 95%
   - Android: `TodayViewModelTest` обновлён под новую сигнатуру (добавлен `GardenRepository`)
   - `TodayViewModel.registerPushToken`: обёрнут в try-catch для test-safe запуска
   - `testOptions`: `isReturnDefaultValues=true`, `--add-opens` для mockk+JDK21
   - Известное ограничение: Android unit tests не запускаются через `./gradlew test` из-за кириллицы в пути + AGP 9 + Windows — задокументировано в `ARCHITECTURE.md`
   - `ARCHITECTURE.md` создан: полный архитектурный документ (стек, структура, API, БД, инфраструктура)
   - `certbot.timer` активен (twice daily) — автопродление работает ✅
   - Context7 MCP прописан в `~/.claude/settings.json`

3. **10 пунктов to-do (бэклог)**
   - CTA "Добавить посадку" на TodayScreen и HarvestScreen ✅
   - Поиск в справочнике культур (client-side фильтрация) ✅
   - Онбординг: Snackbar после CreateGardenScreen ✅
   - Кнопка "Завершить сезон" в меню карточки посадки ✅
   - Сводный журнал "Сделано сегодня" на TodayScreen ✅
   - Урожай с группировкой по культуре (expandable карточка) ✅
   - Маркеры полива на календаре из расчётных дат (wateringFreqDays) ✅
   - Badge с числом посадок с просроченными задачами ✅
   - Карточка посадки: 1 кнопка вместо 2 ✅
   - Дневной вид календаря (уже был) ✅

4. **5 правок после билд-ревью**
   - Рефреш после записи действия: `onDismiss` вызывает `onRefresh()`
   - Стадия культуры по-русски: `STAGE_LABELS` в PlantingPickerBottomSheet
   - Клик по карточке задачи → открывает `ActionLogBottomSheet` с предвыбранным типом + иконка ChevronRight
   - Календарь: `CalendarRepository` загружает `/today`, задачи дня добавляются на текущую дату; новые цвета для типов событий
   - Badge + "Требуется:": `TokenStorage.savePendingTasks(Map<Int,String>)`, `TodayViewModel` сохраняет после загрузки, `PlantingsViewModel` читает, карточка посадки показывает красным "💧 Требуется полив" и т.п.

### Технические решения
- `TokenStorage.pendingTasks` — формат `"plantingId:actionType,..."` в SharedPreferences
- Badge вкладки "Посадки" = `getPendingCount()` (посадки с просроченными задачами)
- Android unit tests: `ClassNotFoundException` при `./gradlew test` — системная проблема (кириллица в пути + AGP 9 + Windows). Обходной путь: Android Studio или переместить проект в ASCII-путь

### Git
- Все изменения смержены в `main` и запушены на GitHub
- Ветки: `fix/build-review`, `feature/todo-ux`, `feature/garden-edit`, `feature/care-push-notifications`

---

## Сессия 2026-06-01 — Критические пункты to-do

### Что сделано

1. **Push при жаре (heat_alert)**
   - `pushService.js`: добавлена `sendHeatAlert(db, gardenId, tempC)` — паттерн аналогичен `sendFrostAlert`
   - `weatherJob.js`: после обновления погоды проверяет `weather.heat_risk` и вызывает `sendHeatAlert`

2. **Экран настроек + управление типами уведомлений**
   - `TokenStorage`: добавлены `isNotificationEnabled(type)` / `setNotificationEnabled(type, enabled)`; константы `NOTIF_FROST/HEAT/WATERING/FERTILIZE`
   - `SettingsViewModel` + `SettingsScreen`: 4 тогла (заморозки / жара / полив / подкормка), сохраняются локально в SharedPreferences
   - Доступен через иконку ⚙️ на TodayScreen (рядом добавлена ✏️ для редактирования участка)
   - `Navigation.kt`: добавлен `Screen.Settings`, включён в `screensWithoutBottomBar`

3. **Deep links из push → нужный экран**
   - `NotificationHelper.showWithDeepLink`: создаёт `PendingIntent` с `push_type` + `garden_id` в Intent extras
   - `DachaPushService.onMessageReceived`: проверяет `isNotificationEnabled(type)` перед показом, вызывает `showWithDeepLink`
   - `MainActivity.onCreate`: читает `intent.getStringExtra(EXTRA_PUSH_TYPE)`, навигирует через `LaunchedEffect`: `frost_alert/heat_alert → Today`, `watering_due/fertilizing_due → Plantings`

### Билд
- `BUILD SUCCESSFUL` без ошибок (2 предупреждения устранены: `hasGarden` extension, `ArrowBack` AutoMirrored)

### Git и деплой
- Ветка `feature/critical-settings-deeplinks-heat` смержена в `main`
- Запушено на GitHub, задеплоено на VPS (`pm2 restart dacha-api` ✅)

