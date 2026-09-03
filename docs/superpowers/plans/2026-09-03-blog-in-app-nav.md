# Блог в приложении + раздел «Справочник» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать блог внутри приложения (список статей + «Статья дня» на «Сегодня») и заодно
починить каркас меню: таб «Ещё» → «Справочник» (культуры + болезни + статьи с общим поиском),
личное и служебное — в «Профиль».

**Architecture:** Три независимых куска. (A) Публичный роут `GET /blog/feed`, читающий уже
существующие файлы блога (манифест + `docs/vk-content/*.md`) через уже существующий парсер —
ни миграции, ни новых таблиц. (B) Перестройка навигации на обеих платформах: один
сегментированный экран «Справочник» переиспользует существующие списки культур/проблем;
контекстные маршруты `crops`/`guide` остаются. (C) Карточка «Статья дня» на «Сегодня» —
чистая детерминированная функция выбора, дублируется на обеих платформах и покрыта тестом.

**Tech Stack:** Fastify + PostgreSQL (backend, тесты vitest — `npm test`), React + TypeScript +
Tailwind (web, тест-раннера нет — `npm run typecheck` + превью на порту 5183),
Kotlin/Compose + JUnit (android, `./gradlew :app:testRustoreDebugUnitTest`).

**Спека:** `docs/superpowers/specs/2026-09-03-blog-in-app-nav-design.md`
**Исследование:** `docs/ui-navigation-research-2026-09.md`

---

## File Structure

**Backend**
- Create: `backend/src/services/blogFeed.js` — чтение манифеста + парс исходников, кэш по `mtime`.
- Create: `backend/src/routes/blog.js` — `GET /blog/feed?limit&offset` (публичный, без авторизации).
- Modify: регистрация роута там же, где остальные (`backend/src/app.js` или `server.js` — смотреть по месту).
- Test: `backend/src/__tests__/unit/blogFeed.test.js` (новый) + `backend/src/__tests__/blog.test.js` (новый).

**Web**
- Create: `web/src/lib/articleOfDay.ts` — `pickArticleOfDay` (чистая функция).
- Create: `web/src/screens/ReferenceScreen.tsx` — поиск + сегменты + группы результатов.
- Create: `web/src/components/ArticleList.tsx`, `web/src/components/CropList.tsx`.
- Modify: `web/src/components/Layout.tsx` — `PRIMARY` с «Справочником», удалить `MORE`/`MoreMenu`.
- Modify: `web/src/screens/CropsScreen.tsx`, `web/src/screens/GuideScreen.tsx` — вынести списки в переиспользуемые компоненты.
- Modify: `web/src/screens/ProfileScreen.tsx` — карточки «Мои семена» и «Настройки».
- Modify: `web/src/screens/TodayScreen.tsx` — секция «Почитать».
- Modify: `web/src/api/client.ts` + `web/src/api/types.ts` — `getBlogFeed`, тип `BlogPost`.
- Modify: `web/src/App.tsx` — маршрут `/reference`.
- Modify: `web/index.html` — `img-src` + `https://images.pexels.com https://ir.ozone.ru`.

**Android**
- Create: `android/.../ui/reference/ReferenceScreen.kt`, `ReferenceViewModel.kt`, `ArticleListBody.kt`.
- Create: `android/.../data/repository/BlogRepository.kt` + модель `BlogPost` + метод в API-интерфейсе.
- Create: `android/.../ui/today/ArticleOfDay.kt` — `pickArticleOfDay` (чистая функция).
- Modify: `android/.../navigation/Navigation.kt` — `Screen.Reference` вместо `Screen.More`, `bottomNavItems`.
- Modify: `android/.../MainActivity.kt` — маршрут `reference`, снятие `Screen.More`.
- Modify: `android/.../ui/crops/CropsScreen.kt`, `ui/guide/GuideScreen.kt` — вынести тела списков.
- Modify: `android/.../ui/profile/ProfileScreen.kt` — карточки «Мои семена», «Настройки», «Веб-версия».
- Modify: `android/.../ui/today/TodayScreen.kt` + `TodayViewModel.kt` — секция «Почитать».
- Delete: `android/.../ui/more/MoreScreen.kt`.
- Test: `android/app/src/test/java/ru/dachakalend/app/today/ArticleOfDayTest.kt` (новый).

**Docs**
- Modify: `summary.md` — строка про блог в приложении и новый каркас меню.
- Modify: `docs/ux-roadmap.md` — записать вариант C (глобальный поиск в шапке) как следующий шаг.
- Modify: `docs/DEPLOY.md` — в разделе «Блог» отметить, что фид приложения читает те же файлы (нового шага деплоя нет).
- Modify: `session-note.md` — запись сессии.

---

## Phase A — фид (backend)

- [ ] A1. `blogFeed.js`: чтение `.blog-manifest.json`, группировка по `sourceFile`, парс через
      `parseContentFile`, матч по `title`, сборка `{slug,title,url,published_at,image,lead}`.
      Пути — из env `BLOG_MANIFEST_PATH` / `BLOG_CONTENT_DIR` с дефолтами на репозиторий.
- [ ] A2. Лид: первый абзац тела, снять `#`/`**`, обрезать до 200 символов по границе слова + «…».
- [ ] A3. Сортировка по `scheduledAt` ↓ (tie-break по `slug`), отбрасывание `scheduledAt > now`.
- [ ] A4. Кэш в памяти с инвалидацией по `mtimeMs` манифеста; отсутствующий манифест → пустой фид.
- [ ] A5. Роут `GET /blog/feed?limit&offset` (дефолт `limit=20`, максимум 100), ответ `{items,total}`.
- [ ] A6. Тесты (vitest): лид и обрезка · сортировка · будущие посты · нет манифеста ·
      пересчёт по `mtime` · `limit/offset/total` на роуте. `npm test` — зелёный.

## Phase B — «Справочник» на web

- [ ] B1. Вынести список культур из `CropsScreen.tsx` в `components/CropList.tsx`; убедиться,
      что для проблем переиспользуется существующий `components/ProblemList.tsx`, а не пишется второй.
- [ ] B2. `api/client.ts`: `getBlogFeed(limit, offset)` с `auth: false`; тип `BlogPost` в `types.ts`.
- [ ] B3. `components/ArticleList.tsx`: карточка (картинка/🌱, заголовок, дата, лид), кнопка
      «Показать ещё», тап → `window.open(url, '_blank', 'noopener')`.
- [ ] B4. `screens/ReferenceScreen.tsx`: одно поле поиска; чипы `Все / Культуры / Болезни / Статьи`;
      пустой запрос → список активного сегмента («Все» → статьи); непустой → группы результатов
      по всем трём корпусам. Сегмент в query (`?tab=`).
- [ ] B5. `Layout.tsx`: «Справочник» в `PRIMARY` вместо «Профиля»-соседа «Ещё»; удалить `MORE`,
      `MoreMenu` и drop-up. Порядок табов: Сегодня · Календарь · Посадки · Справочник · Профиль.
- [ ] B6. `ProfileScreen.tsx`: `HubCard` «Мои семена» (`/seeds`) и «Настройки» (`/settings`).
- [ ] B7. `App.tsx`: маршрут `/reference`; `/crops` и `/guide` остаются (контекстные входы).
- [ ] B8. `npm run typecheck` + живая проверка превью: поиск находит культуру, болезнь и статью
      одним запросом; переход в статью открывает вкладку на `calendacha.ru`.

## Phase C — «Справочник» на Android

- [ ] C1. `Screen.Reference` в `Navigation.kt`, `bottomNavItems` (икона `MenuBook`), удалить `Screen.More`.
- [ ] C2. Вынести тела списков из `CropsScreen.kt` / `GuideScreen.kt` в `CropListBody` / `GuideListBody`;
      сами экраны остаются обёртками (выбор культуры для посадки, `Guide.withCrop`).
- [ ] C3. `BlogRepository` + модель + метод API (публичный, без токена).
- [ ] C4. `ReferenceScreen.kt` + `ReferenceViewModel`: поиск, `SegmentedButton`, три списка,
      группы результатов при непустом запросе. Тап по статье → `CustomTabsIntent` (как в `PaywallScreen.kt`),
      `runCatching` + тост при отсутствии браузера.
- [ ] C5. `MainActivity.kt`: маршрут `reference`, снять `Screen.More`; удалить `ui/more/MoreScreen.kt`.
- [ ] C6. `ProfileScreen.kt`: карточки «Мои семена», «Настройки», «Веб-версия» (перенести код
      открытия веб-версии из удаляемого `MoreScreen`).
- [ ] C7. Сборка `:app:compileRustoreDebugKotlin` зелёная; прогон на эмуляторе: пять табов,
      поиск, переход в статью.

## Phase D — «Статья дня»

- [ ] D1. `web/src/lib/articleOfDay.ts` + `android/.../ui/today/ArticleOfDay.kt` — одна и та же
      чистая функция (месячный пул → `dayOfYear % n`, пустой → null).
- [ ] D2. `ArticleOfDayTest.kt` (JUnit): одинаковая дата → одинаковая статья; месячный фильтр;
      пустой список → null. `./gradlew :app:testRustoreDebugUnitTest` — зелёный.
- [ ] D3. Web `TodayScreen.tsx`: секция «Почитать» последней, после «Советов дня»; при ошибке
      загрузки или пустом фиде секция не рисуется.
- [ ] D4. Android `TodayScreen.kt`/`TodayViewModel.kt`: то же; в офлайн-режиме (`TodayCache`)
      секция скрыта.
- [ ] D5. `web/index.html`: `img-src` + `https://images.pexels.com https://ir.ozone.ru`.
      Проверить, что картинки статей реально отображаются в проде-сборке, а не только в деве.

## Phase E — документация и выкладка

- [ ] E1. Обновить `summary.md`, `docs/ux-roadmap.md` (вариант C — глобальный поиск),
      `docs/DEPLOY.md` (раздел «Блог» — про фид), `session-note.md`.
- [ ] E2. Деплой бэкенда (`git pull` → рестарт pm2) и веб-статики (`npm run build` →
      `/var/www/dacha-web`) по `docs/DEPLOY.md`. Android — в ближайший релиз, отдельной сборки
      под эту задачу не делаем (см. правило: не пересобирать без просьбы).
- [ ] E3. Живая проверка на проде: `GET /blog/feed` отдаёт непустой список; «Статья дня»
      совпадает на web и Android в один день.

---

## Порядок и зависимости

A → (B ∥ C) → D → E. Фазы B и C независимы между собой, но обе требуют A.
D требует наличия фида (A) и места на «Сегодня» — не требует B/C.

## Риски

1. **Матч манифеста с исходником по `title`.** Если заголовок в `.md` правили после публикации,
   запись в манифесте останется со старым заголовком и лид для неё не найдётся. Поведение:
   `lead = null`, карточка рисуется без лида (не падаем). Проверить на реальном манифесте прода
   до релиза — сколько записей без лида.
2. **Вынос списков культур/проблем в общие компоненты** трогает экраны, которые участвуют в
   создании посадки. Регресс-проверка: «Посадки → добавить → выбор культуры → посадить» на обеих
   платформах.
3. **Перенос «Настроек» в «Профиль»** меняет привычный путь у существующих пользователей.
   Оба раздела остаются в 2 тапах; отдельного онбординга/подсказки не делаем.
