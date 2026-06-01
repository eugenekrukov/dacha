# Архитектурный статус и прогресс: "Календарь дачника"

## Текущий статус

- **MVP**: ✅ 100% завершён (5 спринтов + технический долг)
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL | Android (Kotlin + Compose + Hilt)
- **Бэкенд**: `https://dacha.studio1008.com/` · порт 3002 · pm2: `dacha-api`
- **Android**: package `ru.dachakalend.app` · minSdk 26 · targetSdk 34

---

## Следующая сессия (приоритет ↓)

### ✅ Закрыто в предыдущих сессиях
- CTA "Добавить посадку" на TodayScreen и HarvestScreen
- Поиск в справочнике культур
- Онбординг: подсказка после CreateGardenScreen
- Кнопка "Завершить сезон" на посадке
- Сводный журнал "Сделано сегодня" на TodayScreen
- Урожай с группировкой по культуре
- Маркеры полива на календаре из расчётных дат
- Badge с количеством посадок с просроченными задачами
- Упрощение карточки посадки (1 кнопка)
- GardenEditScreen
- Push watering_due / fertilizing_due
- 5 правок после билд-ревью

---

### 🔴 Критично (прямые требования ТЗ)

| # | Задача | Почему важно |
|---|--------|-------------|
| 1 | ✅ **Deep links из push → нужный экран** | frost/heat → Today, watering/fertilizing → Plantings |
| 2 | ✅ **Экран настроек** — уведомления | Доступен через ⚙️ на TodayScreen |
| 3 | ✅ **Управление типами уведомлений** (вкл/выкл frost/heat/watering/fertilizing) | Хранится в SharedPreferences, проверяется в DachaPushService |
| 4 | ✅ **Push при жаре** (`heat_alert`, t ≥ 35°C) | sendHeatAlert() + weatherJob.js |

### 🟡 Важно (Should из ТЗ)

| # | Задача | Почему важно |
|---|--------|-------------|
| 5 | **Выбор культур в онбординге** — предложить добавить культуры сразу после участка | AC из §2.1 ТЗ. Снижает время до первой ценности |
| 6 | **Тип участка в онбординге** (открытый грунт / теплица / смешанный) | ТЗ §5.1. Сейчас тип задаётся на уровне посадки, не участка |
| 7 | **Фильтр посадок по стадии роста** на PlantingsScreen | ТЗ экран 3 "Мои культуры" |
| 8 | **Push при пересадке** (`transplant_due`) | Стадия уже есть в today.js, нужен push по паттерну watering |
| 9 | **Отдельный экран журнала** — все действия по датам с фильтром по культуре | Экран 5 в ТЗ |
| 10 | **История действий в карточке посадки** — хронология по конкретной посадке | ТЗ §5.3: "история действий" как обязательное поле |

### 🟢 Желательно (Could из ТЗ)

| # | Задача | Почему важно |
|---|--------|-------------|
| 12 | **Сравнение урожая по сезонам** | ТЗ §5.8, §4.8. Сейчас только текущий сезон |
| 13 | **Типы действий: пикировка и пересадка** как отдельные виды | ТЗ §5.6. Сейчас объединены в `treatment`/`other` |
| 14 | **Поля участка: площадь и тип почвы** в онбординге и профиле | ТЗ §5.1. Влияют на персонализацию рекомендаций |
| 15 | **Профиль участка** — отдельный экран просмотра (климат, культуры, заметки) | ТЗ §5.2, экран 4.3 Garden Profile |
| 16 | **Совет дня** на TodayScreen | ТЗ §5.4. Повышает ежедневное открытие |
| 17 | **Монетизация** — модель подписки в приложении (RuStore Billing) | ТЗ §12: 299–499 ₽/мес |

---

## Технический долг

- [x] Запустить тест-сьют — 55 тестов, все PASSED ✅
- [x] Дублирующий раздел в `session-note.md` — реального дубля нет ✅
- [x] `ARCHITECTURE.md` создан и заполнен ✅
- [x] Сертификат Let's Encrypt — `certbot.timer` активен, истекает 2026-08-26 ✅

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
