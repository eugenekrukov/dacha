# Архитектурный статус и прогресс: "Календарь дачника"

## Текущий статус

- **MVP**: ✅ 100% завершён (5 спринтов + пост-MVP доработки)
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL | Android (Kotlin + Compose + Hilt)
- **Бэкенд**: `https://dacha.studio1008.com/` · порт 3002 · pm2: `dacha-api`
- **Android**: package `ru.dachakalend.app` · minSdk 26 · targetSdk 34
- **ТЗ**: `docs/ТЗ.pdf`

---

## Следующая сессия (приоритет ↓)

### ⏳ Незакрытые шаги
- [ ] **Пересборка APK** (Android Studio) + проверка на устройстве всех Android-изменений
  серии 2026-06-03 (серверный триал/подписка, реактивный бейдж, иконки журнала/селектора,
  a11y hero, фикс pending, фикс автоподстановки города, сворачиваемый прогноз).
- Гигиена git: одна ветка `main` (стейл-ветки удалены локально и на origin 2026-06-03).

### 🔴 Критично — всё закрыто ✅

### 🟡 Важно — всё закрыто ✅

### 🔒 Безопасность / монетизация (сессия 2026-06-03) ✅
- Серверный триал (migration 014), серверный гейт платных действий (migration 016 + requireAccess → 402)
- P0: IDOR-проверки, JWT expiry + fail-fast secret, rate-limit, helmet, CORS, EncryptedSharedPreferences

### 🎨 Дизайн Solar Dacha — ✅ применён (2026-06-02)
- Nunito Black, оранжевый gradient hero, кремовый фон `#FFF8EB`
- Diagonal clip, анимированный подсолнух, square action buttons
- Все 13 экранов в едином стиле, шрифты бандлированы в APK
- Dismissed рекомендации персистятся с датой (протухают на следующий день)
- Бэкенд: care_task window +3 → 0 дней

### 🟢 Желательно (Could из ТЗ)

| # | Задача | Почему важно |
|---|--------|-------------|
| 12 | **Сравнение урожая по сезонам** | ТЗ §5.8, §4.8 |
| 13 | ~~**Типы действий: пикировка и пересадка**~~ ✅ | ТЗ §5.6 |
| 14 | **Поля участка: площадь и тип почвы** | ТЗ §5.1 |
| 15 | **Профиль участка** — отдельный экран | ТЗ §5.2, экран 4.3 |
| 17 | **Монетизация** — RuStore Billing ✅ 2026-06-02 | 299 ₽/мес + 1990 ₽/год, триал 7 дней |

---

## Технический долг

- [x] Тесты бэкенда: **123 passed** ✅ (добавлены access, careRemindersJob, care_task grouping, auto-flag, trial)
- [x] ARCHITECTURE.md создан ✅
- [x] Сертификат: certbot.timer активен, истекает 2026-08-26 ✅
- [x] CLAUDE.md актуализирован под реальный процесс (ssh hetzner, миграции через psql, Write tool, ff-main)

## Сделано за сессию 2026-06-03

- **Серверный триал** (migration 014, `/auth/me` отдаёт trial_active/days_left) — вместо клиентского
- **Серверный гейт платных действий** (migration 016, requireAccess → 402; клиент синкает подписку)
- **Push-дайджест**: один пуш на участок/тип вместо пуша на каждую посадку (careRemindersJob)
- **Группировка однотипных care-задач** в задачах дня (не вытесняют полив/урожай из топ-7)
- **Баг-фиксы**: pending снимается только при записи действия; просроченные care-задачи не выпадают
  из /today (убрано окно diff>=-1, «выполнено» по дате последнего действия); «Рыхление» в селекторе;
  автоподстановка города под полем (ExposedDropdownMenuBox); реактивный бейдж (StateFlow)
- **UI/консистентность**: Material Icons в журнале и селекторе (эмодзи убраны), чистка эмодзи в
  рекомендациях, серверный флаг `auto` вместо строковой эвристики заметок, a11y hero (контраст/touch),
  прогноз на 7 дней сворачиваемый
- **Git**: подчищены все стейл-ветки (локально и на origin) → одна `main`

---

## Сделано за сессию 2026-06-01 (большая)

### Критические пункты ТЗ
- Deep links из push → нужный экран (frost/heat → Today, watering → Plantings)
- Экран настроек + управление типами уведомлений (5 тоглов)
- heat_alert push (t ≥ 35°C)

### Пункты "Важно" (пп. 5–10)
- OnboardingCropsScreen — выбор культур после создания участка
- Тип участка (грунт/теплица/смешанный) + migration 010
- Фильтр посадок по стадии (chips)
- Push transplant_due + тогл в настройках
- JournalScreen — все действия по датам с фильтром
- История действий в PlantingInfoBottomSheet (20 шт.)

### Агрономика и рекомендации
- Рекомендации: 6 категорий (агрономические, погодные, лунный календарь, сезонные, советы по стадии, лайфхаки)
- Сезонные подсказки "пора сажать" с учётом климатической зоны
- Guided flow: care_tasks → задачи дня (окно ±3 дня), стадия `transplanted`
- "Следующий шаг" на карточке посадки (next_care_task)
- Свайп для удаления рекомендации

### Участок и геолокация
- City field теперь сохраняется (migration 012_garden_city)
- GPS позиционирование без Google Play Services (LocationManager)
- Автодополнение города через Photon API (Flow.debounce в ViewModel)
- Автоопределение климатической зоны из Nominatim address
- Полный список 85 регионов РФ с поиском
- Город — обязательное поле; регион — опциональный

### Аутентификация и данные
- Выход из аккаунта в Настройках (с подтверждением)
- AuthViewModel после логина восстанавливает gardenId с сервера → нет ложного CreateGarden флоу
- GET /gardens: сначала участок с наибольшим числом посадок (planting_count DESC)
- POST /gardens: лимит 3 участка на аккаунт

### Баг-фиксы
- Сортировка расписания работ по LocalDate (не по строке DD.MM.YY)
- care_tasks в задачах дня (care_task_due тип)
- Обновление тестов (лимит задач 5→7)
- Переключение Nominatim → Photon для автодополнения городов

---

## Реализованные API (справка)

```
POST /auth/register  POST /auth/login  GET /auth/me  POST /auth/subscription
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
GET /geocode/suggest?q=
```
