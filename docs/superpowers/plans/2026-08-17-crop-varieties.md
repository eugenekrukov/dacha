# План: сорта культур (п. 4.8 improvement-plan) — настоящая база сортов

Дата: 2026-08-17. Статус: **выполнено** (этапы 1–4 — схема+бэкенд+пилот, UI web/Android,
50/55 культур с сортами + окно съёма многолетников, SEO+контент). Детали — `session-note.md`
(2026-08-17). Не в этой ветке: Ревень, Мята, Тимьян, Бархатцы, Петуния (не отвечают на модель
«дни/окно от посадки» без отдельного решения, см. риск в разделе ниже).

## Что уже есть (проверено по коду, не по плану)

- `plantings.variety VARCHAR(120)` — миграция `046_planting_variety.sql`, свободный текст.
  Принимается в `POST /plantings` (обрезка до 120), показывается в web (`AddPlantingForm`,
  `PlantingsScreen`, `PlantingDetailScreen`) и Android (`PlantingsScreen`, `PlantingInfoScreen`).
  **То есть «лёгкий уровень» из формулировки 4.8 сделан ещё в 046** — план 4.8 про это молчит.
- `seeds.variety VARCHAR(120)` (миграция 060) — тоже свободный текст, отдельная сущность.
- Сроки живут только на культуре: `crops.harvest_days`, `crops.transplant_days`,
  `crops.climate_zones[зона].transplant_start`.

## Решения (согласовано с владельцем 2026-08-17)

1. Сорт **влияет на расчёты** (сроки урожая, «Сегодня», календарь), а не только справочно.
2. Объём v1 — **широкий**: все 55 культур, ориентир ~500 сортов.
3. Источник — **Госреестр** (`reestr.gossortrf.ru`, обновление по понедельникам, ~27,8 тыс.
   записей, официальный документ → не объект авторского права) + **ручная сверка дней до
   урожая** по каталогам оригинаторов, с фиксацией источника в строке.

## Где `harvest_days` реально работает (полная карта, грепом)

| Файл | Что делает |
|------|-----------|
| `backend/src/routes/plantings.js:153,156` | лимит перебора `care_tasks` в `getNextCareTask` / `getOverdueCareTask` |
| `backend/src/routes/plantings.js:160` | `expected_harvest_at` → Android `CalendarViewModel:167`, web календарь |
| `backend/src/routes/today.js:56` → `utils/todayLogic.js:529` | `careLimit` для задач ухода |
| `backend/src/utils/todayLogic.js:630` | задача «Пора убирать урожай» |
| `backend/src/routes/recommendations.js:96` | совет `harvest_soon` за 5 дней |

Правило: **переопределение сорта вводится одним хелпером и подставляется во все пять точек
сразу**. Патчить только `expected_harvest_at` нельзя — «Сегодня» и рекомендации разъедутся
с календарём, это классический разъезд, который здесь уже случался (см. `harvest-due-unification`).

## Схема

Миграция `073_crop_varieties.sql`:

```sql
CREATE TABLE IF NOT EXISTS crop_varieties (
  id                SERIAL PRIMARY KEY,
  crop_id           INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  name              VARCHAR(120) NOT NULL,
  slug              TEXT UNIQUE,          -- для будущих SEO-страниц
  ripening          VARCHAR(20),          -- early|mid|late (овощи) / summer|autumn|winter (плодовые)
  harvest_days      INTEGER,              -- перекрывает crops.harvest_days; NULL = данных нет
  harvest_doy_start SMALLINT,             -- для многолетних/плодовых: окно съёма, день года
  harvest_doy_end   SMALLINT,
  transplant_days   INTEGER,              -- NULL = как у культуры
  is_hybrid         BOOLEAN DEFAULT false,-- F1
  conditions        VARCHAR(20),          -- soil|greenhouse|any
  regions           SMALLINT[],           -- коды регионов допуска Госреестра 1..12
  gossort_number    VARCHAR(20),
  year_registered   SMALLINT,
  notes             TEXT,
  source            TEXT NOT NULL,        -- откуда взяты сроки; без источника строку не заливаем
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (crop_id, name)
);
CREATE INDEX IF NOT EXISTS idx_crop_varieties_crop ON crop_varieties(crop_id);
-- GRANT для dacha_user обязателен (урок миграций 055 и 060)
```

Миграция `074_planting_variety_id.sql`:
`ALTER TABLE plantings ADD COLUMN IF NOT EXISTS variety_id INTEGER REFERENCES crop_varieties(id);`

Колонку `plantings.variety` **не трогаем**: у пользователей уже лежат свои сорта, и «свой
сорт» остаётся валидным вводом. При выборе из списка пишем оба поля (`variety_id` + `variety`
= имя сорта), чтобы старые клиенты, журнал и аналитика продолжали работать без изменений.

Почему две колонки, а не только FK: сорт из коробки семян может отсутствовать в Госреестре
(и в нашей базе), запрещать его ввод — регресс уже работающей фичи.

Многолетние/плодовые: у яблони «110 дней от посадки» бессмысленно — сорт задаёт **окно съёма**
(`harvest_doy_*`, летний/осенний/зимний), поэтому у них заполняем окно, а `harvest_days` NULL.

## Бэкенд

1. `backend/src/utils/todayLogic.js` — экспортировать
   `effectiveHarvestDays(row)` → `row.variety_harvest_days ?? row.harvest_days`
   и (для многолетних) `effectiveHarvestWindow(row)`. Один хелпер, ноль дублей.
2. Во все три выборки (`plantings.js` GET / и GET /:id, `today.js`, `recommendations.js`)
   добавить `LEFT JOIN crop_varieties v ON v.id = p.variety_id` и алиасы
   `v.harvest_days AS variety_harvest_days, v.transplant_days AS variety_transplant_days,
   v.name AS variety_name, v.harvest_doy_start, v.harvest_doy_end`.
3. `POST/PUT /plantings` — принимать `variety_id`; валидация: сорт существует **и**
   `crop_varieties.crop_id = plantings.crop_id`, иначе 400 (иначе «Мельба» окажется у томата).
   При валидном `variety_id` заполнять `variety` именем сорта.
4. Новый публичный роут `GET /crops/:id/varieties` (рядом с публичным `GET /crops`).
   Не вкладывать сорта в `GET /crops` — 55 культур × сорта раздуют ответ, который тянут
   оба клиента при каждом открытии справочника.

## Клиенты

- **web**: `AddPlantingForm` — поле «Сорт» из `input` в комбобокс (паттерн уже есть в этой же
  форме у выбора культуры) со списком из `/crops/:id/varieties` + свободный ввод.
  `PlantingDetailScreen` — показать сорт и его срок. `CropCare.tsx` — блок «Сорта».
- **Android**: те же два места (`PlantingsScreen` форма, `PlantingInfoScreen`) — выпадающий
  список по паттерну `CropsScreen` + «свой сорт»; `CropSections.kt` — блок «Сорта».
  Перед кодом — `android/CONVENTIONS.md` и `UI_MANIFEST.md` §11.
- **SEO**: `backend/scripts/generate-spravochnik.js` — таблица сортов на странице культуры
  (сорт · срок/группа спелости · регионы допуска). Отдельные страницы на сорт — не сейчас,
  сначала данные.

## Контент-конвейер (основная работа)

- **A. Выгрузка.** `backend/scripts/import-gossort.js` — тянет реестр по нужным культурам,
  сырьё кладём в `backend/data/gossort/<культура>.json` (в git → воспроизводимо, дифф виден).
  Сначала проверить, отдаёт ли сайт таблицу/JSON; если только HTML — постраничный парсер.
- **B. Маппинг.** словарь «наша культура (55 шт.) → название культуры в Госреестре».
- **C. Отбор.** ≤10–15 сортов на культуру: народно известные + допущенные в большинстве
  регионов + свежие включения. Шорт-лист руками в `docs/varieties/<crop>.csv`.
- **D. Сроки.** Дни до урожая — из каталогов оригинаторов, **подтверждение двумя источниками**.
  Не подтверждено → `harvest_days = NULL`, показываем группу спелости словами.
  Это прямая страховка от повторения вранья, из-за которого пункт 4.8 и появился.
- **E. Заливка.** Миграция-сид **генерируется** из csv скриптом `scripts/gen-varieties-migration.js`.
  SQL на 500 строк руками не пишем.

## Проверки

- vitest (бэкенд — `npm test`): переопределение срока сортом даёт другой `expected_harvest_at`
  и другую дату задачи «Пора убирать урожай»; `variety_id` чужой культуры → 400.
- Скрипт-инвариант по данным: у каждой строки с числом есть `source`; нет `harvest_days`
  меньше `transplant_days` культуры; у `category='fruit'` заполнено окно, а не дни.

## Порядок

1. Схема + бэкенд-плюмбинг + пилот на 3 культурах (томат, огурец, картофель) руками. Проверяемо целиком.
2. UI web + Android на этих данных.
3. Конвейер A–E и заливка ~500 сортов.
4. SEO-блок справочника; поправить обещания в контенте (`docs/vk-content`) под то, что реально есть.

## Риски

- В Госреестре нет дней до урожая — только группа спелости; числа берутся из каталогов, это
  ручная работа и главный источник трудозатрат.
- Расхождение названий культур с реестром и дубли сортов между оригинаторами.
- Плодовые: срок съёма зависит от региона — окно `harvest_doy_*` придётся привязывать к зоне
  участка (задел: сдвиг окна по `gardens.climate_zone`, как уже сделано для `season_start`).
