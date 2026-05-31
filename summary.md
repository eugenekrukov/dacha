# Архитектурный статус и прогресс: "Календарь дачника"

## Текущий статус

- **MVP**: ✅ 100% завершён (5 спринтов + технический долг)
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL | Android (Kotlin + Compose + Hilt)
- **Бэкенд**: `https://dacha.studio1008.com/` · порт 3002 · pm2: `dacha-api`
- **Android**: package `ru.dachakalend.app` · minSdk 26 · targetSdk 34

---

## Следующая сессия (приоритет ↓)

| # | Задача | Почему важно |
|---|--------|-------------|
| 1 | **CTA "Добавить посадку"** на TodayScreen и HarvestScreen | Пустые экраны без посадок тупиковые, нет пути вперёд |
| 2 | **Поиск в справочнике культур** | При 50 культурах фильтр по категориям недостаточен |
| 3 | **Онбординг: подсказка после CreateGardenScreen** | "Теперь добавьте первую культуру" (Snackbar) |
| 4 | **Кнопка "Завершить сезон"** на посадке | Логичный путь закрытия посадки после сбора урожая |
| 5 | **Сводный журнал действий** | GET /actions без planting_id, "что делал сегодня" |
| 6 | **Урожай с группировкой по культуре** | Сколько томатов всего за сезон |
| 7 | **Маркеры календаря из расчётных дат** | Сейчас из /reminders, нужны даты из логики посадок |
| 8 | **Дневной вид календаря** | Список задач на выбранный день |
| 9 | **Badge на вкладке "Посадки"** | Количество активных посадок |
| 10 | **Уменьшить кнопки в карточке посадки** | Сейчас 4 действия, много для аудитории 40+ |

---

## Технический долг

- [ ] Запустить тест-сьют и зафиксировать покрытие (`npm run test:coverage` + `./gradlew test`)
- [ ] Убрать дублирующий раздел в `session-note.md` (сессия 2026-05-31 задвоена)
- [ ] Перенести архитектурную документацию (структура проекта, API-эндпоинты) в `ARCHITECTURE.md`
- [ ] Сертификат Let's Encrypt истекает ~2026-08-27 — поставить напоминание на автопродление

---

## Завершённые спринты (архив)

<details>
<summary>Спринт 1 — Каркас продукта ✅</summary>

- Структура backend (Fastify + PostgreSQL), все API-роуты MVP
- SQL-миграции 9 сущностей + seed справочника культур
- Деплой на VPS, HTTPS (dacha.studio1008.com), авторизация end-to-end
</details>

<details>
<summary>Спринт 2 — Главная и календарь ✅</summary>

- `GET /today` — агрегирующий эндпоинт с приоритетами задач
- TodayScreen, LoginScreen, RegisterScreen, CreateGardenScreen
- Месячный календарь с маркерами событий
</details>

<details>
<summary>Спринт 3 — Культуры и журнал ✅</summary>

- CropsScreen, CropDetailScreen, PlantingsScreen
- ActionLogBottomSheet (2-3 тапа), ReminderWorker (WorkManager)
- Фильтрация по категориям, навигация Crops → CropDetail
</details>

<details>
<summary>Спринт 4 — Погода и уведомления ✅</summary>

- Open-Meteo интеграция, фоновый cron-джоб каждые 3 часа
- WeatherRepository, RecommendationsRepository, реальные данные на TodayScreen
- RuStore Push SDK 6.0.0, DachaPushService, frost_alert end-to-end
</details>

<details>
<summary>Спринт 5 — Урожай и аналитика ✅</summary>

- HarvestScreen (список + сводная карточка + BottomSheet)
- AnalyticsScreen (streak, счётчики, график активности)
- `GET /actions/export` CSV, `GET /analytics/summary`
</details>

<details>
<summary>Post-MVP (2026-05-31) ✅</summary>

- База знаний 50 культур (миграции 005, 006) — watering_details, diseases, neighbors
- CropDetailScreen с вкладками Уход / Болезни / Соседи
- Геокодирование по населённому пункту (Nominatim OSM)
- Параметры посадки: quantity, conditions (грунт/теплица), миграция 007
- Рекомендации: теплица снимает frost_alert, +30% к интервалу полива
- Климатическая зона: фильтрация сроков посева по зоне пользователя
- Карточка посадки: last_action_at, formatIsoDate
- Быстрые действия на TodayScreen (preselectedType, PlantingPickerBottomSheet)
- Admin-guard для POST/PUT /crops (ADMIN_EMAIL в .env)
- Фиксы: action_type enum, fallback рекомендаций, моргание экрана, сортировка дат, UTF-8 в .js
- Тесты: 35+ backend (Vitest + Supertest), 16+ Android ViewModel (MockK + Turbine)
</details>

<details>
<summary>Сессия 2026-05-31 (продолжение) ✅</summary>

- GardenEditScreen — экран редактирования участка (PUT /gardens/:id), кнопка ⚙️ на TodayScreen
- Push watering_due / fertilizing_due — careRemindersJob (ежедневно 09:00), дедупликация care_alert_log
- Миграция 009_care_alert_log.sql задеплоена на VPS
</details>

---

## Реализованные API (справка)

```
POST /auth/register  POST /auth/login  GET /auth/me
POST /gardens  GET /gardens  GET /gardens/:id  PUT /gardens/:id
GET /crops  GET /crops/:id  POST /crops  PUT /crops/:id
POST /plantings  GET /plantings  GET /plantings/:id
  PATCH /plantings/:id/stage  PATCH /plantings/:id/info  DELETE /plantings/:id
POST /actions  GET /actions  GET /actions/export
GET /weather?garden_id=
GET /recommendations?garden_id=
GET /today?garden_id=
POST /reminders  GET /reminders
GET /harvests  POST /harvests
POST /push-tokens  DELETE /push-tokens
GET /analytics/summary
```
