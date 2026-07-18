# Статус и бэклог: «Календарь дачника»

> **Этот файл — главный. Читать первым.** Текущий статус + открытые задачи.
>
> **Карта документации:**
> - История сессий — `session-note.md` (новое сверху) + `session-note-archive.md` (старое).
> - Приоритизированный план доработок (техдолг/фиксы → фичи) — `docs/improvement-plan.md`.
> - Отложенные задачи этапа 2+ — `docs/ux-roadmap.md` (единый источник бэклога).
> - Активные планы фич — `docs/superpowers/plans/` + `specs/` (сейчас: offline-today, unified-task-dismiss). Завершённые → `docs/archive/`.
> - Архитектура — `ARCHITECTURE.md`; конвенции — `android/CONVENTIONS.md`, `backend/CONVENTIONS.md`; деплой/ops — `docs/DEPLOY.md`; тесты — `TESTING.md`; инструкции AI — `CLAUDE.md`.
> - Маркетинг/ASO — `docs/promo-plan-first-paying.md`, `docs/gtm-strategy-ru.md`, `docs/aso-*.md`, `docs/master-plan-2026.md`.
> - База знаний Obsidian (`Dacha/`) — навигация поверх репо; источник истины всегда репо.

## Текущий статус

- **MVP**: ✅ 100% завершён, в проде. Идёт пост-MVP-разработка.
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL · Android (Kotlin + Compose + Hilt) · Веб (React + Vite + TS + Tailwind).
- **Бэкенд**: `https://dacha.studio1008.com/` · pm2 `dacha-api`.
- **Веб**: `https://dacha.studio1008.com/app/` (папка `web/`, статика `/var/www/dacha-web`, nginx `location /app/`). Та же БД/API.
- **Android**: package `ru.dachakalend.app` · minSdk 26 · compileSdk/targetSdk **36** (Android 16) · флейворы `rustore`/`gplay` (samsung удалён 2026-06-30) (сборка `:app:compileGplayDebugKotlin` и т.п.).
- **Справочник проблем растений**: в проде на всех платформах (78 записей по факту на 2026-07-02, было
  указано ~68 — актуализировано при аудите `/spravochnik/`). См. `docs/plant-guide-plan.md`.
- **SEO-справочник `/spravochnik/`**: 133 публичные статические страницы (55 культур + 78 проблем),
  в проде. См. «Актуальные открытые задачи» ниже + `session-note.md` (2026-07-02).
- **Блог `/blog/`** (2026-07-18): статьи контент-плана (`docs/vk-content/*.md`) публикуются и на сайте,
  не только в ВК/Telegram/Дзен — `backend/scripts/generate-blog.js`, общие SEO-хелперы с
  spravochnik-генератором вынесены в `backend/scripts/lib/seoPage.js`. Только статьи, ещё не
  опубликованные в ВК (фильтр по дате поста). Ops — `docs/DEPLOY.md` («Блог»), детали —
  `session-note.md` (2026-07-18 (4)).
- **Бэкенд-тесты**: 398/398 (`npm test` → vitest run; **НЕ** jest).
- **Лента «Мой участок»**: запись-центричная (`action`/`photo`/`milestone`), единый блок «действие+заметка+фото»
  на ленте и в журнале посадки. В проде (`GET /feed`, без миграции). Android — vc6/1.0.3 (не опубликован).
- **Автопостер ВК** (маркетинг): очередь с расписанием `vk_post_queue` (миграция 048) + cron `vkQueueJob`,
  публикует посты из md-файла контента в сообщество `calendacha`. Нужен ПОЛЬЗОВАТЕЛЬСКИЙ VK-токен. Ops — `docs/DEPLOY.md`.
- **Автопостер Telegram** (маркетинг, 2026-07-18): та же очередь `vk_post_queue` (миграция 058,
  колонки `telegram_*`) + cron `telegramQueueJob`, публикует в канал `@calendacha` через бота
  `@calendacha_bot` (Bot API). Независимый статус публикации от ВК. Ops — `docs/DEPLOY.md`.
- ✅ **E3 исправлен (2026-06-25)**: Android JVM unit-тесты теперь запускаются в этом окружении.
  Корень — Gradle-тест-воркер на Windows не грузил классы из `build/`-каталога с кириллическим путём
  (`ClassNotFoundException`, native-кодировка classpath-argfile, баг JVM/Gradle gradle/gradle#30304).
  Фикс — `android/build.gradle.kts`: при не-ASCII пути проекта `buildDir` всех модулей переносится в
  `%LOCALAPPDATA%\dacha-android-build` (ASCII), исходники остаются на месте. После фикса всплыл
  реальный баг в `TodayViewModelTest` — relaxed-мок `ActionsRepository` не синтезировал `SharedFlow<T>`
  (MockK `KotlinNothingValueException`), исправлено явным стабом в `setUp()`. `:app:testRustoreDebugUnitTest`
  и `:app:testGplayDebugUnitTest` — зелёные.
- **F1 офлайн «Сегодня»** (Android+backend): влит в `main` (read-кэш `TodayCache` + очередь записи
  `ActionQueue` + `client_id`-идемпотентность). **Backend задеплоен** (прод `8f0b09a`, миграция 045
  применена на проде). Android-часть — в сборке vc7/1.0.4, ждёт публикации в магазинах. См. session-note (2026-06-21).

## Монетизация (ФИНАЛ 2026-07-18 — free+premium, без триала)

Web + Google Play + RuStore — **free+premium, БЕЗ рекламы.** 1 сад и до `FREE_PLANTING_LIMIT`
(`backend/src/utils/access.js`, сейчас 3) активных посадок одновременно — **бесплатно навсегда**,
без ограничения по времени. Подписка «Дачник Про» снимает лимит на число посадок. Прежняя
7-дневная триал-модель (ФИНАЛ 2026-06-16) отменена: пользователи не успевали сформировать привычку
до paywall — гейт бил по основному циклу (посадка/уход/урожай) раньше, чем накапливалась история,
которую жалко терять.
Гейт — только на `POST /plantings` (402 `plan_limit_reached` сверх лимита, если нет подписки/промо);
`POST /actions`/`/harvests` свободны в рамках уже созданных посадок (не гейтятся вовсе). `GET`-роуты
(сегодня/погода/справочник/лунный календарь/лента) не гейтились и раньше.
Samsung снят с публикации. Оплата — **ЮKassa напрямую** (Shop ID 1376599), **разовые платежи**
(рекуррент запрещён самозанятому → продление вручную); доступ продлевает вебхук `/billing/webhook`.
Чек — НПД (422-ФЗ): **авто-регистрируется в «Мой налог»** через `lknpd.nalog.ru` (сервис ЮKassa «Чеки
для самозанятых» прекращён 29.12.2025). Поток: webhook → `payments.npd_status` → cron `nalogJob` →
`addIncome` через RU-релей (`nalog-relay.php` на reg.ru, `NALOG_RELAY_URL`) → письмо с чеком. Детали —
`docs/DEPLOY.md` («Мой налог») и `session-note.md` (2026-06-19). ⚠️ `YOOKASSA_RECEIPT_MODE=off`.
✅ **E2E подтверждён реальным платежом 19.06.2026** (payment 7 → `registered`). По пути исправлены 2 бага:
релей терял токен ФНС (Apache режет `Authorization` → шлём токен в `X-Relay-Auth`) и `scp` затирал секрет
релея (теперь секрет в файле `.relay-secret`, не в гите). Секрет `NALOG_RELAY_SECRET` ротирован. Детали — session-note (2).
Серверный гейт: `utils/access.js` `hasAccess` (`subscription_until`/промо — доступ «Дачник Про»,
БЕЗ триала) + `FREE_PLANTING_LIMIT`, проверка инлайн в `routes/plantings.js` (декоратор `requireAccess`
удалён — был не нужен нигде, кроме этой проверки). Рекламной модели (Yandex Ads / РСЯ) больше нет —
выпилена вместе с Samsung.
⚠️ Код samsung-флейвора в Android ещё не удалён (не срочно, флейвор просто не публикуется).
⚠️ `docs/gtm-strategy-ru.md` писался под триал-модель — метрики/email-цепочка нуждаются в пересмотре
под free→paid (флаг оставлен в начале файла). Письма жизненного цикла (`trialEmailsJob.js`, дни
1/3/5/6/8 после регистрации) переформулированы под free-tier нудж, но остаются на прежнем расписании.

## Актуальные открытые задачи

**✅ Фикс favicon на лендинге (2026-07-14, ЗАДЕПЛОЕНО прямым `scp` + nginx location):**
Яндекс.Вебмастер не видел иконку — она была data-URI SVG-эмодзи, `/favicon.ico` отдавал 404. Сделан
реальный `favicon.ico`/`favicon.svg`/`favicon-192.png`/`apple-touch-icon.png`, подключены на всех
страницах лендинга, добавлен nginx location для этих файлов (иначе уходили в proxy_pass на API).
Детали — `session-note.md` (2026-07-14). ⚠️ **Не закоммичено в git** — нужно `git add`/`commit`/`push`
`landing/favicon.*`, `landing/apple-touch-icon.png`, `landing/*.html`.

**✅ Фикс «пуши по собранным посадкам» (2026-06-29, ЗАДЕПЛОЕНО `8f0b09a`):**
Жалоба «по завершённым посадкам идут пуши» оказалась не багом фильтра `stage='done'` (он работает), а следствием неидемпотентного `POST /gardens`: эндпоинт плодил участки-дубли (комментарий обещал «вернуть существующий», код создавал новый при < 3). Забытый участок-сирота с активной посадкой слал пуши, а дайджест показывает только культуру → выглядело как пуш по завершённой. Фикс: `POST /gardens` идемпотентен (возвращает первый существующий, 200, без INSERT); удалён мёртвый лимит-409. Прод-данные: осиротевшая посадка завершена. Детали — `session-note.md` (2026-06-29 (2)).

**✅ Унификация «Убрать урожай» (РЕАЛИЗОВАНО + ЗАДЕПЛОЕНО 2026-06-30; backend `8f0b09a` + веб пересобран `/var/www/dacha-web`):**
Карточка «Убрать урожай» на «Сегодня» (Android + веб) теперь открывает специализированный лог урожая с преднастроенной посадкой и чекбоксом «Это весь урожай в сезоне» (завершает посадку переводом в `stage=done`). Backend: cooldown 3 дня — после записи в `harvests` карточка не показывается снова сразу. Веб: паритетная кнопка «Завершить сезон» на странице посадки. Деталь — `session-note.md` (2026-06-29). Миграций нет.

**✅ Паритет веб-версии с Android — раздел «Профиль» + журнал (P1+P2, ЗАДЕПЛОЕНО 2026-06-23 `e5913fe`):**
Веб догнал Android по разделу «Профиль / Мой участок» (табы Лента/Статистика/Справочник, лента
`action/photo/milestone` с группировкой по месяцам, бесконечной подгрузкой и просмотром/управлением фото)
и журналу (фильтр по культуре + удаление записи). В навбаре Справочник→Профиль. Бэкенд `/feed` уже был в
проде — деплой только веба (`npm run build` → `/var/www/dacha-web`). План и статус — `docs/web-parity-plan.md`
(осталось: P4 онбординг-выбор культур, P5 snooze/reverse-geocode/Web Push).

**✅ Персональная лента «Мой участок» (РЕАЛИЗОВАНА, влита в `main` `baa79e9` 2026-06-22; ⚠️ не запушена/не задеплоена):**
Вкладка «Инфо» заменена на «Профиль / Мой участок» (табы Лента / Статистика / Справочник). Сводная
приватная лента всех фото + вехи сезона (посев/высадка/первый урожай/завершение), группировка по месяцам.
Backend `GET /feed` (UNION, пагинация, без миграции). Фундамент под будущую социализацию. Спека:
`docs/superpowers/specs/2026-06-22-personal-feed-design.md`. Заодно багфиксы тестера: переводы действий
в «Сделано сегодня», клик по карточке посадки, фотолента по месяцам на экране посадки (`5aa76ff`).
Деплой: `git push origin main` → VPS `fetch && reset --hard origin/main` → `pm2 restart dacha-api` (миграции нет).
**Отложено (v1):** счётчики в шапке профиля; инлайн-вкладки Статистика/Справочник; веха «Цветение» (нужна отметка стадии).


**✅ Групповые care-задачи — мульти-посадочное действие (РЕАЛИЗОВАНО + ЗАДЕПЛОЕНО 2026-06-17):**
Сгруппированная care-задача («Прополка: Капуста пекинская, Редис») стала кликабельной → лист
действия с мульти-посадочным режимом. Заголовок — список культур с крестиком удаления (мин. 1),
одно действие пишется во все оставшиеся посадки (клиент циклит `POST /actions` по каждой —
сохраняется per-planting IDOR-проверка; отдельный batch-эндпоинт не нужен).
- Backend: `buildTasks` добавляет `planting_ids: number[]` + `crop_names_with_ids: {id,name}[]`
  в групповой `care_task_due`; `formatTasks` пробрасывает их (одиночные → null). Тесты **266** (+2).
- Web: `TodayTask` += поля; `ActionLogSheet` принимает `plantings: CropRef[]` + `title`
  (групповой режим со списком и крестиками); групповая карточка кликабельна. Проверено в превью.
- Android: `Models.kt` += `CropRef` и поля; новый `MultiActionLogBottomSheet` (общий `ActionLogSheetImpl`);
  VM `logActionMulti`/`logTransplantingMulti`; `TodayScreen` открывает мульти-лист для групповых.
  `:app:compileGplayDebugKotlin` BUILD SUCCESSFUL.
- **✅ Задеплоено**: backend на VPS (`git reset --hard origin/main` → `232d024`, `pm2 restart`,
  health ok; прод `/today` отдаёт `planting_ids`+`crop_names_with_ids`), веб пересобран
  (`/app/` → 200). Android AAB/APK публикует пользователь.

**✅ Задеплоено 2026-06-16** (`b8641ef` контактная почта + `9ffa82d` шапка лендинга): VPS на `52dfb5d`,
лендинг и веб пересобраны/выложены, `/` и `/app/` отдают 200, на сайте новый email `dacha@studio1008.com`.
Ящик `dacha@studio1008.com` создан 2026-06-16 — задача закрыта полностью.

**Google Play (при публикации):**
- ✅ **Третий SHA-1** (App signing key certificate) получен и встроен в ограничение Firebase API-key — FCM на Play-сборке регистрируется. Debug+release SHA-1 тоже добавлены.
- Заменить кнопки магазинов «Скоро» (`#download` `.store-btn[aria-disabled]`) и store-ссылки футера на реальные URL.
- Гайд: `docs/gplay-publishing-guide.md`. ASO-карточки: `docs/aso-gplay-samsung.md` (актуальна, платная модель), `docs/aso-rustore.md`.
- **Название Play** (лимит 30): «Календарь дачника: сад, огород». **Категория**: «Дом и сад» / «Книги и справочники» (Lifestyle в списке нет). Package `ru.dachakalend.app`.
- **Легал-URL (live):** политика `…/privacy`, оферта `…/offer`, удаление `…/account-deletion` (для Data safety → Account deletion).
- **Data Safety** выверен (см. session-note (4)): Email, User IDs, История покупок, Approx+Precise location, Other UGC, Device ID — collected/not shared; рекламы/Advertising ID нет.
- **Feature graphic** 1024×500 — `docs/store-assets/feature-graphic.png`.
- ⚠️ Личный аккаунт → обязательно closed testing (12 тестировщиков, 14 дней) перед production.

**Демо-данные / тест-аккаунты:**
- `demo@dacha.ru` / `demo1234` (прод, store=gplay, триал 30 дн) — участок Краснодар (garden 12) с посадками: на «Сегодня» по одной задаче каждого типа (для скриншотов). См. session-note (4).
- Скиллы статистики (локальные): `/statistic`, `/statistic_user`.

**Пуши (FCM):**
- ✅ Гигиена доставки (2026-06-17): мёртвые токены (`registration-token-not-registered`) удаляются из
  `push_tokens`; `care_alert_log` помечается только при фактической доставке (см. session-note).
- ✅ FCM re-register на тест-устройстве — токен живой (improvement-plan 1.3).
- ✅ **Третий SHA-1** (App signing key) получен и встроен в ограничение Firebase API-key — FCM на
  Play-сборке регистрируется.

**P4 «Аккаунт и безопасность» — хвост (отдельные циклы):**
- ✅ C — смена города/региона (Android `GardenEditScreen`+`CityInputField`, web `EditGardenScreen`).
- D — управление участками + переключатель активного сада. ⚠️ 2026-06-25: владелец сомневается в
  востребованности — сначала оценить реальный спрос, не строить вслепую.
- Уведомления на web (Web Push / настройки типов).

**✅ Грядки + севооборот («план участка») — ГОТОВО (2026-07-01):** бэкенд (миграции 052/053 + GRANT 055)
+ UI на web (в проде) и Android (в `main`, ждёт релиза): поле «Место», инлайн CRUD грядок (грунт/теплица),
подсказка севооборота по семейству за 3 года, правка «Места»/«Условий» в карточке. «Условия» перенесены
из формы создания в карточку; на вебе добавлен выбор способа посадки. Планы:
`docs/superpowers/plans/2026-06-30-garden-beds-{web,android}-ui.md`. Хвост: Android-релиз + on-device QA.

**✅ Лунный календарь (РЕАЛИЗОВАН + ЗАДЕПЛОЕН 2026-07-01, backend+web; Android в `main`):** встроен
в существующий экран «Календарь» (не отдельным экраном — по фидбэку владельца): иконка фазы Луны
в каждой ячейке дня + карточка «фаза+совет+"Не сажать"» в панели выбранного дня, рядом с обычными
задачами. `GET /moon-calendar?year=&month=` (прод, health ok), веб пересобран (`/app/` 200). Тесты
398/398 (+5). Хвост: on-device QA. Детали — `session-note.md` (2026-07-01 (2) и (3)).

**✅ Опубликовано:** Google Play и RuStore оба на **vc9/1.0.6** (лаг RuStore из релиза 2026-07-01
закрыт этим релизом — перестройка «Профиля», таб «Ещё», грядки+севооборот, лунный календарь и
контраст hero «Сегодня» — все волны догнаны на обеих площадках). Владелец подтвердил публикацию
2026-07-18.

**🚧 Готовится к публикации: versionCode 9→10, versionName 1.0.6→1.0.7** (bump уже в `main`,
коммит `ae0f6c2`, 2026-07-12; сборку AAB и публикацию делает владелец вручную). Собирает: **free+premium
вместо 7-дневного триала** (главное изменение — см. «Монетизация» выше, сессия 2026-07-18) + **напоминание
об осмотре посадки** (`24aa0a3` — пункт меню посадки ставит периодический локальный пуш через
WorkManager, раз в день/2/3 дня, без изменений backend) + фикс переноса лейбла «Календарь» в
нижнем меню (`ae0f6c2`). Версия единая для Gplay и RuStore — оба магазина сейчас на одной волне,
отдельных текстов на два магазина больше не нужно. Тексты release notes — `session-note.md`
(2026-07-18 (2)).

**✅ SEO-справочник `/spravochnik/` — ГОТОВО И В ПРОДЕ (2026-07-02):** статические страницы культур
(`/spravochnik/kultury/{slug}/`, 55 шт.) и проблем растений (`/spravochnik/problemy/{slug}/`, 78 шт.)
на базе публичных `/crops`+`/guide`, генератор `backend/scripts/generate-spravochnik.js` (запускать
после `backfill-crop-slugs.js`). Title/description проверены и уложены в SEO-лимиты (60/160 симв.)
реальным аудитом живых страниц, не только по дизайну. Ссылка «Справочник» в nav/footer лендинга.
Файлы верификации Google Search Console + Яндекс.Вебмастер выложены в корень сайта — владельцу
осталось подтвердить права в обоих сервисах и добавить sitemap.xml (140 URL) вручную. Детали,
включая побочно найденный и исправленный баг с правами на таблицах Postgres (`care_alert_log`,
`garden_beds`, `subscription_emails` принадлежали `postgres` вместо `dacha_user`) — `session-note.md`
(2026-07-02). Деплой — `docs/DEPLOY.md` («Справочник /spravochnik/»).

**IndexNow подключён (2026-07-02):** `backend/scripts/submit-indexnow.js` шлёт все URL из
`sitemap.xml` на `https://yandex.com/indexnow` (по протоколу уведомление уходит и другим
участникам, не только Яндексу). Требует `INDEXNOW_KEY` в `.env` + файл-подтверждение `{ключ}.txt`
в корне сайта. Первая отправка успешна (202, 140 URL) — гонять после будущих партий новых страниц.

**⚠️ Полуготовые фичи (бэкенд без UI / в процессе):**
- **Единое снуз/удаление задач дня** (`unified-task-dismiss`): миграция `054_today_task_dismissals.sql`
  создана; роуты (`POST /today/tasks/dismiss`, `GET /today/tasks/dismissed`) + фильтрация в `GET /today`
  + клиенты — не реализованы. План/спека: `docs/superpowers/{plans,specs}/2026-06-27-unified-task-dismiss*`.

**Технический долг:** ✅ закрыт (2026-06-30).
- ✅ **E3** — исправлено 2026-06-25, см. «Текущий статус» выше.
- ✅ **2.1** `logout()` зовёт `deletePushToken()` до очистки auth — было уже реализовано (план был стале).
- ✅ **2.2** код samsung-флейвора + весь рекламный стек (РСЯ) удалён; остались rustore+gplay, обе компилируются.

**«Could» из ТЗ:**
- §5.8 сравнение урожая по сезонам · §5.2 профиль участка (отдельный экран) · §5.1 поля участка (площадь, тип почвы).

**Этап 2+ (полный бэклог):** `docs/ux-roadmap.md`. Из крупного НЕ сделано: грядки/севооборот UI (бэкенд готов), управление участками+switcher (⏸ спрос под вопросом), уведомления на web, §5.8 сравнение урожая по сезонам, §5.1 поля участка, П8 десктоп-layout, долгий хвост фото справочника (~16). P5 изображения — ✅ сделано; фото-диагностика — ❌ отклонена (низкая точность).

## Реализованные API (справка)

```
POST /auth/register  POST /auth/login  GET /auth/me  POST /auth/subscription
POST /auth/verify-email  POST /auth/resend-verification
POST /auth/forgot-password  POST /auth/reset-password
PATCH /auth/password  POST /auth/change-email  POST /auth/confirm-email-change  DELETE /auth/me
POST /promo/redeem
POST /billing/create-payment  POST /billing/webhook  POST /billing/cancel-autorenew
GET /guide  GET /guide/:slug
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
GET /analytics/summary
GET /geocode/suggest?q=
POST /push-tokens  DELETE /push-tokens
```
