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
| 1 | **Экран редактирования участка** (`GardenEditScreen`) | `PUT /gardens/:id` есть, UI нет. Пользователь не может исправить ошибку онбординга |
| 2 | **Смёржить `feature/planting-setup-conditions` → `main`** | Ветка протестирована, висит незакрытой |
| 3 | **Push-нотификации: полив/подкормка просрочены** | Frost-алерт есть, но главный юзкейс (забыл полить) не покрыт |

---

## Бэклог (не в текущем спринте, но приоритетно)

### UX / Флоу
- [ ] **CTA "Добавить посадку" на TodayScreen и HarvestScreen** — пустые экраны без посадок тупиковые, нет пути вперёд
- [ ] **Поиск в справочнике культур** — при 50 культурах фильтр по категориям недостаточен
- [ ] **Онбординг: подсказка после CreateGardenScreen** — "Теперь добавьте первую культуру" (Snackbar или коуч-марк)
- [ ] **Кнопка "Завершить сезон" на посадке** — логичный путь закрытия посадки после сбора урожая
- [ ] **Сводный журнал действий** — `GET /actions` без `planting_id`, сводка "что делал сегодня по всему участку"
- [ ] **Урожай с группировкой по культуре** — сколько томатов всего за сезон

### Календарь
- [ ] **Связать маркеры календаря с расчётными датами задач** — сейчас маркеры из `/reminders`, нужны даты из логики посадок
- [ ] **Дневной вид календаря** — список задач на выбранный день

### Технические
- [ ] **Badge на вкладке "Посадки"** — количество активных посадок
- [ ] **Уменьшить количество кнопок в карточке посадки** — сейчас 4 действия, много для аудитории 40+
- [ ] **Push: подписка на полив/подкормку** — `watering_due` и `fertilizing_due` через RuStore Push (аналогично `frost_alert`)

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
