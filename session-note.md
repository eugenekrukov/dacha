# Протокол рабочей сессии разработчика

**Дата последней сессии**: 2026-06-13

## ЗАКРЫТИЕ СЕССИИ 2026-06-13 — ВЕБ-ВЕРСИЯ создана и задеплоена в прод

Большая сессия: с нуля построена и выкачена в прод **веб-версия** «Календаря дачника» на той же
единой БД/API (Android и бэкенд-ядро не тронуты). Полный план — `docs/web-migration-plan.md`,
деплой/доступ к VPS — `docs/DEPLOY.md`.

**Сделано:**
1. **Веб-клиент** `web/` (React 18 + Vite + TS + Tailwind, дизайн Solar Dacha, Bearer-токен в
   localStorage). Под `dacha.studio1008.com/app/` (vite `base:'/app/'`).
2. **Экраны:** вход/регистрация, создание участка (автодополнение города через `/geocode`), Сегодня
   (погода+прогноз 7 дней+задачи дня+советы с dismiss), Посадки (список: последнее действие+след.
   задача; добавление), карточка посадки (инфо/урожай/**расписание работ** с маркерами и препаратами/
   история), Справочник культур (+категории локализованы)+карточка, Журнал (+CSV), Урожай/Аналитика,
   Настройки, Paywall (редирект ЮKassa + промокод), подтверждение email.
3. **Запись действия — 12 категорий** (модалка `ActionLogSheet`, как в приложении; «Высадка» меняет
   стадию на transplanted). Открывается: из **задачи дня** (клик по карточке → запись с предвыбором по
   типу задачи; отдельная ссылка «Подробнее» на посадку) и из **карточки посадки** (кнопка «Записать
   действие» над расписанием).
4. **Меню:** Сегодня · Посадки · **Информация ▾** (Справочник культур / Журнал действий / Аналитика) ·
   Настройки. Десктоп — одна строка; мобиле — нижний навбар + дропап. Блок «Данные» из Настроек убран.
5. **Бэкенд (аддитивно, задеплоено):** `store='web'` в enum register/login; `last_action_type` в
   `GET /plantings`. Параллельный фикс пушей (`45884af`) влит и задеплоен.
6. **Лендинг:** две точки входа (кнопка **«Войти»** → `/app/` + «Скачать приложение»), оферта/тарифы/
   FAQ/политика/JSON-LD включают веб-версию (платная как RuStore), фиксы мобильной шапки и skip-link.
7. **Монетизация веба — РЕШЕНО: платная** (как RuStore), 7 дней триал → подписка ЮKassa.

**Деплой (всё в проде, `origin/main` HEAD после сессии):** backend `git reset --hard origin/main` +
`pm2 restart`; веб собран на VPS (`/var/www/dacha-api/web` → `npm ci && npm run build`) → `/var/www/dacha-web`;
nginx `location /app/` (alias+SPA-fallback). Лендинг — `cp landing/* → /var/www/dacha-landing` (отдельный каталог).
`https://dacha.studio1008.com/app/` → 200. **⚠️ SSH на VPS работает только через PowerShell-инструмент**
(Windows ssh-agent держит ключ; Bash-инструмент доступа не имеет) — см. `docs/DEPLOY.md` (+нюансы кавычек).

**Не сделано (вторичное):** экран Календаря, сброс пароля (бэкенд готов), Web Push, геолокация
(нужен reverse-geocode endpoint). Скриншот-инструмент превью весь конец сессии флапал таймаутами —
проверки делались через preview eval/snapshot.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-12 — редизайн лендинга + SEO/GEO + блок «Как начать» (задеплоено)

За сессию: лендинг `dacha.studio1008.com` **редизайнен** (современные UI/UX-элементы), доведён
по **SEO/GEO**, добавлен раздел **«Как начать»** (фикс непонятной CTA-воронки). Всё **задеплоено в прод**,
закоммичено и влито в `main`. Тексты оферты/политики/Samsung — НЕ трогались (были корректны).

**Состояние:** `main` = `bedd62b` (== origin). Прод живой. Бэкенд НЕ затрагивался.

**Что сделано (только лендинг + nginx):**
1. **Редизайн UI/UX** (`landing/index.html`, скилл `redesign-skill`, стек/шрифт Nunito сохранены):
   прогресс-бар прокрутки, scrollspy (активный пункт меню), бегущая лента культур (marquee),
   spotlight-карточки (свечение под курсором), анимированный градиент заголовка, glass-хедер с
   внутренней кромкой, pressed-состояния кнопок, выравнивание тарифов по нижнему краю (flex-column),
   пунктирный коннектор шагов, `tabular-nums`, `text-wrap: balance/pretty`. Фикс бага: `.fine`
   ссылался на несуществующую `var(--brown)` → `var(--muted)`.
2. **SEO/GEO** (скилл `searchfit-seo:on-page-seo`, on-page ~55→~90):
   - `<title>` (50 симв., ключ в начале) + `description` (158 симв.) + **`<link rel=canonical>`**;
   - **JSON-LD `@graph`**: `SoftwareApplication` (offers 299/1990/0 ₽) + `Person` (издатель Крюков Е.В.,
     ИНН, email) + **`FAQPage`** (6 Q&A, синхронны видимому FAQ); `datePublished`/`dateModified`;
   - **видимый FAQ-блок** (6 вопросов, `#faq`), пункт «Вопросы» в навигации;
   - семантическая обёртка **`<main id="main">`** + skip-link;
   - **`landing/robots.txt`** + **`landing/sitemap.xml`** (новые файлы);
   - **OG-картинка** `landing/og.png` 1200×630 (сгенерирована Pillow в стиле Solar Dacha) +
     `og:image`/`twitter:image`; favicon (🌻), theme-color, OG/Twitter-теги;
   - контент-гэпы: ключи «когда сажать», «лунный календарь» в H2/eyebrow/тексте карточек.
3. **Фикс CTA-воронки** (`#download` «Как начать»): кнопки «Попробовать»/«Начать бесплатно» вели на
   `#pricing` — было непонятно, как пробовать. Добавлен раздел «Как начать» (3 шага: скачать →
   регистрация → 7 дней бесплатно) + кнопки магазинов в состоянии **«Скоро»** (приложение ещё не
   опубликовано — выбор пользователя). Hero/nav CTA и store-ссылки футера ведут на `#download`
   (мёртвых `href="#"` больше нет).
4. **nginx (VPS)**: раздавал из лендинг-папки только `/` и `/billing/return` → новые статики
   (`/og.png`, `/robots.txt`, `/sitemap.xml`) проксировались на API = 404. Добавлены 3 exact-локации
   `location = /<file> { root /var/www/dacha-landing; }` перед `location /`. Бэкап
   `/etc/nginx/sites-available/dacha.bak.predeploy`, `nginx -t` OK, `systemctl reload`. API/SSL не задеты.
5. **Деплой**: `scp` 4 файлов в `/var/www/dacha-landing/` (`index.html`, `og.png`, `robots.txt`,
   `sitemap.xml`), `chown www-data`. Бэкапы `index.html.bak.*` на сервере. Проверено вживую:
   `/`, `/og.png`, `/robots.txt`, `/sitemap.xml` → 200; `/health` → 200.
6. **Git**: 3 коммита влиты в `main` (`7ec004e` редизайн+SEO, `ef1ca68` доки ASO прошлой сессии,
   `bedd62b` фикс CTA). Запушено в origin. ⚠️ **Деплой лендинга — через `scp`, НЕ git** (на VPS
   лендинг лежит в `/var/www/dacha-landing/`, не под git-зеркалом `dacha-api`).

**TO-DO дальше:**
- После публикации приложения — заменить кнопки магазинов «Скоро» (`#download` `.store-btn`
  `aria-disabled`) и store-ссылки футера на реальные URL.
- Остальной бэклог (FCM 3-й SHA-1, смена пароля тест-аккаунта, баннер РСЯ, E3, «Could» ТЗ) — без изменений.

**SSH-нюанс:** деплой/ssh к VPS работает из **PowerShell** (Windows OpenSSH, alias `hetzner` с
`IdentityFile C:\Users\e-kru\.ssh\hetzner`). Из Bash-инструмента POSIX-ssh этот ключ НЕ подхватывает
(Windows-путь в ssh-config) → `Permission denied`. Для ssh/scp использовать PowerShell.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-11 (продолжение) — ASO для GP/Samsung + лендинг (offer/privacy)

За сессию: подготовлены ASO-карточки для Google Play/Samsung; оферта и политика конфиденциальности
на лендинге доработаны под bескплатно+реклама модель (`gplay`/`samsung`); блок подписки на лендинге
переработан для пользователей этих сторов. **Изменения только локально, на VPS не задеплоены.**

**Что сделано:**
1. **ASO-карточки GP/Samsung** — новый `docs/aso-gplay-samsung.md` (по аналогии с `docs/aso-rustore.md`):
   - Название «Календарь дачника: сад и огород» (30 симв., укладывается в лимиты GP/Samsung), запасной
     вариант «Календарь дачника: огород».
   - Краткое описание (72/80 симв.) с акцентом на «бесплатно».
   - Полное описание адаптировано из RuStore-версии: убран CTA про пробный период/подписку, добавлены
     2 явных «бесплатно»-маркера, добавлена фраза «поддерживается показом рекламы».
   - Раздел «Чувствительные разрешения и Data Safety»: `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION`,
     `POST_NOTIFICATIONS`, `AD_ID` (добавляется Yandex Mobile Ads SDK) + таблица категорий Data Safety
     (Местоположение/Email/User ID/контент/push-токен/Advertising ID — последний передаётся рекламной
     сети Яндекса). Отмечено: «История покупок» неприменима (`PAYMENTS_ENABLED=false`).
   - Открытый вопрос зафиксирован: `MobileAds.setUserConsent(true)` в `Ads.init` выставлено безусловно —
     минимально закрыто пунктом в политике конфиденциальности (см. ниже), явный consent-dialog UI —
     отдельная Android-задача (не сделана).
2. **Оферта (`landing/index.html`, `#legal`)** — добавлен абзац «Область действия» в начало текста
   оферты: распространяется только на платную подписку «Дачник Про» в **RuStore**-версии; версии
   Google Play и Samsung Galaxy Store бесплатны, оферта на них не распространяется (монетизация
   рекламой — см. политику конфиденциальности).
3. **Политика конфиденциальности (`landing/index.html`, `#legal`)**:
   - Добавлен пункт в список собираемых данных: «Версии Google Play и Samsung Galaxy Store: рекламный
     идентификатор устройства (Advertising ID) — для показа рекламы»; пункт про платёжные данные
     уточнён как «версия RuStore».
   - `<h4>Платёжные данные</h4>` → `<h4>Платёжные данные (версия RuStore)</h4>`.
   - Новый раздел `<h4>Реклама (версии Google Play и Samsung Galaxy Store)</h4>` — описывает Yandex
     Mobile Ads SDK, обработку Advertising ID, ссылку на политику конфиденциальности Яндекса; явно
     указано, что в RuStore реклама не показывается и эти данные не обрабатываются.
4. **Блок подписки (`#pricing`)** — добавлен callout перед карточками тарифов: для тех, кто установил
   приложение из Google Play/Samsung Galaxy Store, всё бесплатно сразу (без подписки/триала, вместо
   неё — реклама); тарифы «Дачник Про» относятся только к RuStore-версии.
5. **Footer** — `.store-row` дополнен бейджами «▶️ Google Play» и «📦 Samsung Galaxy Store» (пока
   `href="#"` — заполнить ссылками после публикации); обновлена дата в `.fine`.

**TO-DO дальше (см. также `summary.md`):**
- Задеплоить обновлённый `landing/index.html` на VPS (`/var/www/dacha-landing/`).
- Собрать release AAB для флейвора `gplay` (и затем `samsung`).
- Заполнить реальные ссылки в `.store-row` после публикации в сторах.
- Решить открытый вопрос consent-диалога для рекламы (`MobileAds.setUserConsent`) — отдельная задача.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-11 — старт следующей

За сессию: **FCM выкачен в прод и проверен на устройстве**; починен побочный **500 на логине**;
закрыта **дыра с возвратами ЮKassa**; доведена реклама; почищен git; настроено ограничение API-key.

**Состояние:** `main` = `cebe7ec` (== origin). Бэкенд-тесты **213/213**. Одна ветка `main`
(стейл-ветки удалены локально и на origin). Android — все флейворы compile/assemble BUILD SUCCESSFUL.

**Что сделано:**
1. **Пуши FCM → ПРОД, проверено сквозняком.** `feature/push-fcm` влита (`6a56788`). Бэкенд задеплоен:
   `npm install` (firebase-admin), миграция **026** (`push_tokens.provider`), сервисный аккаунт Firebase
   на VPS `/var/www/dacha-api/secrets/fcm-service-account.json` (`600`, project `calendacha`),
   `FCM_SERVICE_ACCOUNT_PATH` в `.env`, `pm2 restart`. Smoke-тест: firebase-admin аутентифицируется в FCM
   (dummy-токен отклонён). На Samsung A55 (gplay-сборка): зарегистрирован FCM-токен `provider=fcm` (142
   симв.), отправлен тест-пуш через `sendViaFcm` → **доставлен**. Канал доставки FCM работает.
2. **Фикс 500 на логине (E5).** Деплой E5-кода впервые активировал обращения к `users.store`, а миграция
   **025** (`user_store`) не была применена → 500. Применил `025_user_store.sql` на VPS. Логин 200.
   (E5-код был влит в `main` ещё `d0778e2`, но прод стоял на `3fcbb42` до этого деплоя.)
3. **🔴 Дыра с возвратами ЮKassa — ЗАКРЫТА** (`cebe7ec`, тесты +3 → 213). Вебхук обрабатывал только
   `payment.succeeded`/`canceled` — **`refund.succeeded` игнорировался**, поэтому после возврата денег
   доступ оставался активным до конца периода (оплатил → вернул → бесплатно). Добавлено: ветка
   `refund.succeeded` в `routes/billing.js` (верификация через `yk.getRefund`, поиск платежа по
   `payment_id`, отзыв выданных дней `access.revokeSubscription`, `payments.status=refunded`,
   `auto_renew=false`; идемпотентно), `yookassaService.getRefund`, `access.revokeSubscription`.
   ⚠️ В кабинете ЮKassa **подписано событие `refund.succeeded`** (сделано пользователем). Миграции нет.
   NB: ретроактивно НЕ правит старые возвраты (user 2 `e-krukov@ya.ru` оставлен с активной подпиской —
   выбор пользователя, тестовый аккаунт `store=gplay`).
4. **Реклама (`88368fe`).** Интерстишл реже: `INTERSTITIAL_EVERY` 6 → **10**. Добавлены лог-слушатели
   загрузки (`tag=Ads`) в `Ads.kt` (gplay+samsung — синхронны). **Баннер диагностирован: код исправен**
   (демо-ID `onAdLoaded`), боевой блок `R-M-19420797-1` отдаёт **`code=4` no-fill** — состояние кабинета
   РСЯ, не баг; налив баннера ожидается после публикации приложения. Длину роликов РСЯ не регулирует.
5. **Ограничение API-key (Google Cloud Console).** В Application restrictions ключа Firebase (`current_key`
   из `google-services.json`) добавлены package `ru.dachakalend.app` + SHA-1: **debug**
   `DA:B4:04:79:C3:7C:2F:FB:EE:D1:20:00:CF:BF:40:F8:29:AC:85:59` и **release** (`~/.android/dacha-release`,
   PKCS12) `A4:2B:98:50:E4:1F:9A:CB:DE:75:37:C6:8…`. API restrictions оставлены «Don't restrict key»
   (Application restrictions достаточно; `google-services.json` — клиентский конфиг, остаётся в git).
6. **Гигиена git.** Удалены влитые стейл-ветки `feature/email-brevo|email-unisender|email-verification|
   notif-permission|push-fcm` (локально и на origin). Осталась только `main`.

**TO-DO следующей сессии (полный — см. `summary.md`):**
- **Google Play (при публикации):** после создания приложения и первой загрузки AAB добавить **третий
  SHA-1** из Play Console → App integrity → **App signing key certificate** в ограничение API-key
  (Google переподписывает APK → иначе FCM на Play-сборке не зарегистрируется).
- **Сменить пароль** тест-аккаунта `e-krukov@ya.ru` (светился в чате) — через «Забыли пароль?».
- **Баннер РСЯ** — дождаться налива боевого блока после публикации (код готов).
- **E3 (давний долг):** Android unit-тесты не запускаются (баг тулчейна AGP 9) — проверка `compile*Kotlin`.
- «Could» из ТЗ (сравнение урожая по сезонам, профиль участка, поля площадь/почва).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-10 — старт следующей

За сессию: **E4** (ЮKassa) задеплоен и проверен боевым платежом (рекуррент запрещён самозанятому →
разовая оплата); лендинг `dacha.studio1008.com` развёрнут + переделан (Solar Dacha, Russo One выпилен);
**E5** (реклама РСЯ + флейворы rustore/gplay/samsung + store-гейт) — код влит в `main` (`d0778e2`),
боевые ID РСЯ вписаны; **пуши** продиагностированы и переведены на прямой **FCM** для gplay/samsung —
код (бэкенд+Android) готов и закоммичен на ветке **`feature/push-fcm`** (НЕ влита/не задеплоена).

**Где продолжить (полный to-do — `summary.md` → «TO-DO следующей сессии»):**
1. `feature/push-fcm` → merge в `main` + push + деплой (npm install firebase-admin, миграция 026,
   сервисный аккаунт Firebase на VPS + `FCM_SERVICE_ACCOUNT_PATH`), тест FCM на Samsung A55.
2. E5: проверить/применить миграцию `025_user_store.sql` на VPS (деплой не подтверждён); проверить
   рекламу на ad-APK.
3. E4: пересборка rustore-APK + тест оплаты на устройстве; вернуть тест-299 ₽; сменить пароль тест-аккаунта.
4. Гигиена git: удалить стейл-ветки (email-*/notif-permission/push-fcm после merge).

Тесты бэкенда **210/210**; Android — все флейворы `compile`/`assembleGplayDebug` BUILD SUCCESSFUL.

---

## Пуши → FCM (2026-06-10): диагностика + бэкенд + Android готовы

**Диагноз:** пуши не приходили — в `backend/.env` не были заданы `RUSTORE_PUSH_*` (sendPush молча
выходил). После добавления ключей RuStore API ответил `400 not a valid FCM registration token` —
старые токены 32-символьные/протухшие, а RuStore-нативная доставка требует пройденной модерации +
совпадения подписи (не выполнено в debug). Устройство теста — Samsung A55 (Google services + RuStore).

**Решение (выбор пользователя): прямой FCM.** rustore → RuStore Push (как есть), gplay/samsung →
FCM напрямую (Firebase на клиенте, FCM HTTP v1 на бэкенде). НЕ через RuStore-релей (в консоли RuStore
FCM — отдельный проект-провайдер, лишняя завязка).

**Бэкенд готов (тесты 210/210):** миграция `026_push_provider.sql` (`push_tokens.provider` default
'rustore'), `services/fcmService.js` (firebase-admin, lazy require, off без `FCM_SERVICE_ACCOUNT_PATH`),
`pushService.sendPush(token,…,provider)` маршрутизирует fcm→Firebase / иначе→vkpns,
`getTokensForGarden` отдаёт `{token,provider}`, роут `/push-tokens` принимает `provider`. package.json
+= `firebase-admin` (нужен `npm install` на деплое). ⏳ НЕ задеплоено/закоммичено.

**Android FCM готов** (`google-services.json` в `android/app/`, проект `calendacha`; rustore compile +
gplay assembleDebug BUILD SUCCESSFUL): плагин `google-services` + `firebase-messaging:24.1.0`;
`DachaFcmService` (FirebaseMessagingService, регистрирует provider='fcm', гейт по флейвору);
`TodayViewModel.registerPushToken` ветвится (rustore→RuStore-токен/'rustore', gplay/samsung→FCM-токен/
'fcm'); `App` инициализирует RuStore Push только в rustore; манифест += FCM-сервис. `push-tokens`
шлёт `provider`. БЕЗ source-set — ветка по `BuildConfig.STORE`.

**Осталось для работы пушей:** (1) деплой бэкенда — миграция 026 + `npm install` (firebase-admin) +
сервисный аккаунт Firebase на VPS + `FCM_SERVICE_ACCOUNT_PATH` в `.env` + pm2 restart; (2) собрать
gplay-APK, поставить на Samsung A55 → регистрируется FCM-токен → бэкенд шлёт через FCM → пуш доходит.
NB: `google-services.json` закоммичен (клиентский конфиг, не серверный секрет).

---

## E5 фазы 1–2 (2026-06-09): реклама РСЯ + флейворы (НЕ задеплоено)

**Бэкенд (store-гейт, тесты 207/207):** миграция `025_user_store.sql` (`users.store`),
`access.isAdSupportedStore` + `hasAccess` (`gplay`/`samsung` → доступ без 402; `rustore`/NULL →
платный гейт), `requireAccess` читает `store`, `auth` register/login принимают `store` (enum).

**Android (все 3 флейвора compile BUILD SUCCESSFUL):**
- Флейворы `rustore`/`gplay`/`samsung` (`build.gradle.kts`) + `BuildConfig` `STORE`/`PAYMENTS_ENABLED`/
  `ADS_ENABLED`/`BANNER_AD_UNIT`/`INTERSTITIAL_AD_UNIT`.
- Реклама изолирована штатными флейвор-папками: `src/rustore/.../ads/Ads.kt` (no-op, без SDK),
  `src/gplay` + `src/samsung/.../ads/Ads.kt` (Yandex `mobileads:7.12.0`, баннер через `AndroidView`+
  `BannerAdView`). Кастомный `src/withAds` через `sourceSets.srcDirs` на AGP 9 НЕ подхватился →
  `Ads.kt` продублирован (синхронизировать при правках). v8 Compose-API нестабилен → взят v7 View-API.
- `Ads.init` в `App`; баннер РСЯ глобально над навбаром в `MainActivity` (только основные экраны,
  no-op в rustore). Клиент шлёт `BuildConfig.STORE` при login/register (`AuthRepository`+модели).
- Гейт по флейвору: Paywall не открывается при `!PAYMENTS_ENABLED`; секция «Подписка» в Настройках
  скрыта в ad-сборках.

**Незакрыто E5:** интерстишл (`Ads.onContentEvent` stub), согласие на рекламу
(`MobileAds.setUserConsent`), боевые ID объявлений (сейчас демо; нужен аккаунт РСЯ), деплой бэкенда
(миграция 025 + код store), пересборка/проверка ad-APK. Команда сборки флейвора:
`:app:compileGplayDebugKotlin` (не `compileDebugKotlin` — с флейворами его больше нет).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-06 (E4 задеплоен в прод + лендинг + ЮKassa-аккаунт)

**Деплой E4 завершён.** `main` HEAD `d5f8234` (feat(billing): ЮKassa + удаление Russo One, 44 файла).
На VPS: `git fetch+reset --hard origin/main`, миграция `024_yookassa_billing.sql` +
`ALTER TABLE payments OWNER TO dacha_user`, в `backend/.env` добавлены `YOOKASSA_SHOP_ID=1376599` +
секретный ключ (перевыпущен — старый засветился в чате) + `YOOKASSA_RETURN_URL` + `YOOKASSA_RECEIPT_MODE=on`,
`pm2 restart dacha-api`. health ok, `[renewal-job] Запущен (10:00)` в логах, ошибок нет.

**Лендинг** `https://dacha.studio1008.com/` развёрнут (`/var/www/dacha-landing/`, nginx `location = /` +
`= /billing/return`), переделан в стиле Solar Dacha (SVG-иллюстрации, анимации, Nunito Black — Russo One
выпилен и из приложения тоже). Оферта: чек НПД (422-ФЗ), реквизиты Крюков Е.В. ИНН 540861624727.

**ЮKassa-аккаунт самозанятого** подключён: метод приёма «На сайте» (API, не мобильный SDK),
поле «реквизиты» = ссылка на сайт (ИНН на странице). Shop ID 1376599. Чеки/налоги: при подключённой
интеграции «Мой налог» ЮKassa авто-регистрирует доход + чек НПД; `YOOKASSA_RECEIPT_MODE` переключает
передачу receipt без правок кода.

**Незакрыто по E4**: (1) вебхук в кабинете ЮKassa → `…/billing/webhook` (`payment.succeeded`/`canceled`);
(2) смоук-тест `POST /billing/create-payment` (валидность ключей → confirmation_url); (3) пересборка APK
с актуального `main` + боевой платёж с устройства (Custom Tab → оплата → доступ; тоггл автопродления).
Тесты backend 202/202; Android `compileDebugKotlin` BUILD SUCCESSFUL.

**Следующий эпик**: E5 (реклама РСЯ для GP/Samsung) — флейворы + Yandex Mobile Ads SDK.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E4-Android: RuStore Billing → ЮKassa)

**Что сделано** (Android E4, `compileDebugKotlin` BUILD SUCCESSFUL):
- `SubscriptionManager` переписан без `RuStoreBillingClientFactory`: `refresh()` читает `/auth/me`
  (источник правды по подписке = вебхук ЮKassa); `startPayment(plan)` → `confirmation_url`;
  `cancelAutoRenew()`. `SubscriptionStatus` += `subscriptionUntil`/`autoRenew`/`plan`.
- `BillingRepository` (new) — `createPayment(plan): Result<String>`, `cancelAutoRenew(): Result<Unit>`.
  `DachaApi` += `createPayment`/`cancelAutoRenew`. `UserProfile` += `subscribed`/`subscriptionUntil`/
  `autoRenew`/`plan`/`hasSavedCard`; новый `CreatePaymentResponse`.
- `PaywallViewModel.purchase(plan)` → ссылка оплаты; `PaywallScreen` открывает её в Chrome Custom Tab
  (`androidx.browser`), по `ON_RESUME` поллит `/auth/me` (8×1.5с, флаг `paymentStarted`). Убрана
  «Восстановить покупки». Футер обновлён (ЮKassa, автопродление в Настройках).
- Настройки: дата окончания подписки + тоггл «Автопродление» (выкл → `cancel-autorenew`; вкл — новой
  оплатой). `SettingsViewModel.cancelAutoRenew()`.
- `App.kt` — убран `RuStoreBillingClientFactory.init` (Push НЕ тронут). `build.gradle.kts`/
  `libs.versions.toml` — RuStore Billing убран, добавлен `androidx.browser`; `RUSTORE_CONSOLE_APP_ID` удалён.
- `CONVENTIONS.md §11` переписан под ЮKassa; таблица репозиториев += `BillingRepository`.

**Незакрытое по E4**: деплой бэкенда (нужны ключи ЮKassa самозанятого) + проверка APK на устройстве
(оплата картой → возврат → доступ; отключение автопродления; промокоды/триал). Android unit-тесты
не запускаются (баг тулчейна E3) — проверка через `compileDebugKotlin`.

**Следующий эпик**: E5 (реклама РСЯ для GP/Samsung) — флейворы + Yandex Mobile Ads SDK.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E4-бэкенд: ЮKassa реализован)

**Что сделано** (бэкенд E4, тесты **196/196** — было 179, +17):
- Миграция `024_yookassa_billing.sql` (`users.payment_method_id`/`auto_renew`/`plan` + таблица
  `payments` с `yk_payment_id UNIQUE` для идемпотентности). ⚠️ деплой: `ALTER TABLE payments OWNER TO dacha_user;`
- `services/yookassaService.js` — `createPayment` (redirect + `save_payment_method:true`),
  `chargeRecurring` (по `payment_method_id`, без confirmation), `getPayment` (верификация вебхука),
  `buildReceipt` (чек 54-ФЗ, самозанятый `vat_code=1`). Basic-auth + `Idempotence-Key` (crypto.randomUUID).
  Без `YOOKASSA_SHOP_ID`/`SECRET_KEY` — биллинг off (как email/push).
- `routes/billing.js` — `POST /create-payment {plan}` → `confirmation_url` (503 если off);
  `POST /webhook` (публичный: при включённом биллинге перезапрашивает платёж из API = защита от
  подделки; идемпотентность по `yk_payment_id`; `succeeded` → `extendSubscription` + сохранить карту +
  `auto_renew=true`; `canceled` → запись); `POST /cancel-autorenew` (auth).
- `jobs/renewalJob.js` (cron 10:00) — автосписание для истекающих ≤1 дня; защита от двойного списания;
  продление делает вебхук (единый источник истины). Подключён в `app.js` onReady.
- `utils/access.js` += `extendSubscription(currentUntil, days)` (продлевает от конца активной подписки).
- `/auth/me` += `auto_renew`/`plan`/`subscription_until`/`has_saved_card` (токен карты наружу НЕ отдаём).
- `.env.example` += блок ЮKassa. Тесты: `billing.test.js` (12), `renewalJob.test.js` (5).

**НЕ задеплоено** (нужны ключи самозанятого ЮKassa): миграция 024 + OWNER, `YOOKASSA_SHOP_ID`/
`YOOKASSA_SECRET_KEY`/`YOOKASSA_RETURN_URL` в `.env`, вебхук `…/billing/webhook` в кабинете ЮKassa.

**Следующий шаг**: Android-часть E4 — вырезать RuStore Billing из `SubscriptionManager`, оплата через
Custom Tab по `confirmation_url`, тоггл автопродления в Настройках. Затем эпик E5 (реклама РСЯ).

---

## ПЛАН СЕССИИ 2026-06-05 (E4: RuStore Billing → ЮKassa — RuStore не подключает самозанятых)

**Проблема**: RuStore больше НЕ подключает монетизацию самозанятым → внутримагазинный биллинг
недоступен. Переход на прямые платежи картой через **ЮKassa (YooKassa)**. Также за сессию закрыты
пункты 1–2 прошлого бэклога: Brevo-ключ перевыпущен ✅, APK пересобран и проверен на устройстве ✅.

**Решения пользователя**: провайдер **ЮKassa**; модель **автопродление (рекуррент)**; дистрибуция
**RuStore + Google Play + Samsung**; платёжный UI — **Chrome Custom Tab + `confirmation_url`**
(карта сохраняется на сервере). Сначала — зафиксировать план в доках (этот блок), потом код.

**⚠️ Риск магазинов**: Google Play / Samsung требуют свой биллинг для in-app подписок (Google Play
Billing в РФ не работает с 2022 → серая зона). Оплату изолировать в `BillingRepository` для гейта
по build-флейвору при модерации. Бизнес-решение пользователя — техника готова к обоим сценариям.

**Архитектура** (детали и чеклист — `summary.md`, блок «E4»):
- Серверный гейт уже на «оплачено до даты» (`subscription_until`/`hasAccess`/402) — меняем ТОЛЬКО
  источник флага: вебхук ЮKassa вместо `POST /auth/subscription`. Триал/промокоды/402 — без изменений.
- Рекуррент ЮKassa: 1-й платёж `save_payment_method:true` → `payment_method.id`; автосписания —
  серверный `POST /v3/payments` с `payment_method_id` без `confirmation`; вебхуки
  `payment.succeeded`/`canceled`; чек 54-ФЗ через объект `receipt`. Basic-auth + `Idempotence-Key`.
- Бэкенд: миграция `024` (`payment_method_id`/`auto_renew`/`plan` + таблица `payments`),
  `services/yookassaService.js`, `routes/billing.js` (create-payment/webhook/cancel-autorenew),
  cron `renewalJob.js`. Env `YOOKASSA_SHOP_ID`/`YOOKASSA_SECRET_KEY`/`YOOKASSA_RETURN_URL`.
- Android: вырезать `RuStoreBillingClientFactory` из `SubscriptionManager` (Push НЕ трогать),
  оплата через Custom Tab, тоггл автопродления в Настройках.

**Анализ магазинов (2026-06-05)**: оплата из РФ невозможна в GP (биллинг РФ-аккаунтам отключён
26.12.2024; внешняя оплата разрешена только в США/ЕЭЗ; даже зарубежное юрлицо не спасает — РФ-карта
не пройдёт в Google-биллинге) и Samsung. RuStore разрешает альтернативные платежи вне своих SDK
БЕЗ комиссии → ЮKassa в RuStore-сборке легитимна (основной канал). Вывод: монетизация РАЗНАЯ по сторам.

**E5 — реклама РСЯ для GP/Samsung** (бесплатная модель, делаем после E4): AdMob/Google не вариант
(новые РФ-аккаунты закрыты) → **Yandex Mobile Ads SDK 8.0.0** (работает с самозанятыми, нативный
Compose: `rememberBannerAdState`/`Banner`, `rememberInterstitialAdLoader`). Флейворы
`rustore`/`gplay`/`samsung` + `BuildConfig` `PAYMENTS_ENABLED`/`ADS_ENABLED`; SDK рекламы только в
gplay/samsung через source sets (rustore — no-op `AdController`). Бэкенд: `users.store` снимает
жёсткий 402 для неплатёжных сторов. Детали и чеклист — `summary.md` блок E5.

**Следующий шаг**: реализация E4 — начать с бэкенда (миграция + сервис + роуты + вебхук + cron + тесты),
затем Android под готовый API. Нужен аккаунт ЮKassa (Shop ID + Secret Key) для самозанятого. E5 (реклама)
— следующим эпиком; нужен аккаунт РСЯ + ID объявлений.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E1.2: переход на Brevo — Unisender требует NS-трекинг-домен)

**Проблема**: Unisender Go при отправке вернул ошибку **229 `Custom backend domain or tracking domain
required`** — нужен трекинг/бэкенд-домен, т.е. NS-делегирование `noreply.studio1008.com` на
`uns1/2/3.unisender.com`. Но reg.ru в веб-редакторе **не даёт добавлять NS** для поддомена. Также у
Unisender Go маленький бесплатный лимит.

**Решение (выбор пользователя)**: **Brevo** (ex-Sendinblue) — бесплатный тариф, HTTP API на 443,
подтверждение домена через **CNAME/TXT** (reg.ru это умеет, без NS).
- `emailService.js`: добавлен драйвер `sendViaBrevo` (POST `https://api.brevo.com/v3/smtp/email`,
  заголовок `api-key`, тело `{sender,to,subject,htmlContent,textContent}`, успех 201, таймаут 12с).
  `sendMail` приоритет: `BREVO_API_KEY` → Brevo; `UNISENDER_GO_API_KEY` → Unisender; `SMTP_HOST` → SMTP; off.
- `.env.example`: блок Brevo (вариант 1) + Unisender (вариант 2) + SMTP-фолбэк. Тесты **179/179** ✅.

**ЗАДЕПЛОЕНО И ПРОВЕРЕНО** (2026-06-05): домен `studio1008.com` подтверждён в Brevo (DKIM/SPF/TXT в reg.ru),
ключ `BREVO_API_KEY` вписан в `.env` пользователем (через меня НЕ проходил). Сервер на `2069e9f`,
`pm2 restart` выполнен, health 200. Прямой тест Brevo API → 201 messageId, письмо во «Входящих» Gmail.
Сквозной тест: `POST /auth/forgot-password` → `{ok:true}` мгновенно, без ошибок в логах. E1 рабочий в проде.

**Остаётся**: перевыпустить засветившийся в чате первый Brevo-ключ (если ещё не); пересборка/проверка
Android-APK (экраны verify/reset, баннер) на устройстве.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E1.1: почта через Unisender Go — обход блокировки SMTP на Hetzner)

**Проблема**: после деплоя E1 сброс пароля давал таймаут. Диагностика с VPS показала: **Hetzner режет
исходящий SMTP** — порты 25/465/2525 закрыты, на 587 проходит TCP+SMTP-приветствие, но TLS-handshake
(STARTTLS) виснет наглухо. Прямой SMTP (reg.ru `scp93.hosting.reg.ru`) с этого сервера невозможен.
Порт 443 (HTTPS) открыт.

**Решение (выбор пользователя)**: российский транзакционный сервис по HTTP API — **Unisender Go**.
- `emailService.js`: добавлен драйвер `sendViaUnisender` (POST `go1.unisender.ru/ru/transactional/api/v1/
  email/send.json`, заголовок `X-API-KEY`, тело `message{recipients,subject,from_email,from_name,body,
  skip_unsubscribe:1}`, AbortController-таймаут 12с). `sendMail` выбирает драйвер: `UNISENDER_GO_API_KEY`
  → HTTP API; иначе `SMTP_HOST` → nodemailer; иначе off. Новых npm-зависимостей нет (`node-fetch` уже есть).
- SMTP-транспорт получил таймауты (10–12с). Отправка в роутах (`register`/`resend`/`forgot-password`) —
  **fire-and-forget** (`.catch()` без `await`) → запрос больше не висит при недоступности почты.
- `.env.example`: блок Unisender Go + SMTP помечен фолбэком. `CONVENTIONS.md §23` обновлён.
- Тесты backend **179/179** ✅ (состав не менялся; почта в тестах off → no-op).

**Деплой E1 (выполнен пользователем ранее)**: код `673018f` на сервере, миграция 023 применена
(`email_codes` owner `dacha_user`, `users.email_verified` есть), nodemailer установлен.

**Незакрытые шаги**:
1. Аккаунт Unisender Go: зарегистрировать, подтвердить домен `studio1008.com` (SPF/DKIM-записи из кабинета),
   подтвердить отправителя `noreply@studio1008.com`, получить API-ключ.
2. На VPS в `.env`: `UNISENDER_GO_API_KEY=<ключ>`, `SMTP_FROM=noreply@studio1008.com`, `APP_NAME=...`;
   деплой ветки `feature/email-unisender` (`git fetch+reset`, **npm install не нужен**, `pm2 restart`).
3. Проверка: регистрация → код на почту; сброс пароля → код → новый пароль → вход.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E1: подтверждение email + сброс пароля)

**Тема**: бэклог-пункт E1 — почта не верифицировалась (нет SMTP), не было восстановления пароля.
**Решения пользователя**: 6-значный код в приложении (не ссылка); мягкий гейт (пускаем, баннер-напоминание);
оба флоу сразу; generic SMTP через env (nodemailer).

**Бэкенд:**
- `services/emailService.js` — nodemailer, провайдер-независимый (env `SMTP_*`, `APP_NAME`). Без `SMTP_HOST`
  почта отключена, флоу не падает (как pushService). `generateCode()` (6 цифр), письма verify/reset.
- Миграция `023_email_verification.sql`: `users.email_verified` (существующие → true; новые → false) +
  таблица `email_codes(user_id, code, purpose verify|reset, expires_at, used_at)`. Коды 15 мин, одноразовые.
- `routes/auth.js`: register шлёт код verify (best-effort); `/auth/me` отдаёт `email_verified`. Новые роуты:
  `POST /verify-email` (auth), `/resend-verification` (auth, 3/10мин), `/forgot-password` (публ., всегда 200 —
  не раскрываем email), `/reset-password` (публ., заодно email_verified=true). `package.json` += nodemailer.
- `.env.example` += SMTP-блок. Тесты backend **179/179** (+10: verify-email, forgot/reset-password).

**Android:**
- `UserProfile.emailVerified` (дефолт true — login не отдаёт поле). `DachaApi`/`AuthRepository` += 4 метода.
- `VerifyEmailScreen`+VM (после регистрации `RegisterScreen` отдаёт email → экран с «Позже» → CreateGarden;
  из Настроек — баннер «Подтвердите email» → тот же экран без «Позже»). `SettingsViewModel` грузит профиль
  (`me()`), перечитывает по ON_RESUME. `PasswordResetScreen`+VM (двухшаговый: email → код+новый пароль),
  вход из `LoginScreen` «Забыли пароль?». Навигация: `Screen.VerifyEmail` (+args email/fromRegister),
  `Screen.PasswordReset`. Детали — `CONVENTIONS.md §23`.

**Сборка**: backend `vitest` **179/179** ✅, Android `:app:compileDebugKotlin` ✅ (BUILD SUCCESSFUL).

**Незакрытые шаги (КРИТИЧНО — деплой):**
1. **Деплой бэкенда**: `git fetch + reset --hard origin/main` → `cd backend && npm install` (nodemailer!) →
   `sudo -u postgres psql -d dacha_db -f .../023_email_verification.sql` →
   `ALTER TABLE email_codes OWNER TO dacha_user;` → задать `SMTP_*` в `.env` → `pm2 restart dacha-api`.
2. Пересборка APK + проверка на устройстве (регистрация→код, баннер в Настройках, забыли пароль→сброс→вход).
3. Параллельно остаётся незакрытым E2 (APK с runtime-запросом уведомлений) и более ранние изменения.

**Остаток бэклога**: E3 (Android unit-тесты — баг тулчейна). + «Could» из ТЗ.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-05 (E2: runtime-запрос POST_NOTIFICATIONS)

**Тема**: бэклог-пункт E2 — на Android 13+ (API ≥ 33) уведомления молча не показывались, т.к.
разрешение `POST_NOTIFICATIONS` объявлено в манифесте, но не запрашивалось в рантайме.

**Что сделано** (только Android, бэкенд НЕ затронут):
- **`TokenStorage`**: флаг `isNotifPermissionAsked()`/`setNotifPermissionAsked()` (ключ
  `notif_permission_asked`) — чтобы спросить ровно один раз. Чистится при `logout()`.
- **`MainActivity`**: `rememberLauncherForActivityResult(RequestPermission())` + `LaunchedEffect(Unit)`,
  который запускает запрос когда `SDK_INT >= TIRAMISU`, пользователь залогинен + есть участок, разрешение
  не выдано и ещё не спрашивали. Колбэк ставит флаг `setNotifPermissionAsked()`.
- Детали — `CONVENTIONS.md §22`.

**Сборка**: `:app:compileDebugKotlin` ✅ (BUILD SUCCESSFUL). Бэкенд не менялся — тесты/деплой не нужны.

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK + проверка на устройстве с Android 13+ (при первом входе
в приложение появляется системный диалог запроса уведомлений; после выдачи напоминания/пуши доходят).

**Остаток бэклога**: E1 (верификация email + сброс пароля), E3 (Android unit-тесты не запускаются — баг
тулчейна). + «Could» из ТЗ.

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (шестая: убрано имя + релизная сборка + правки тестов)

**Темы**: подписанная release-сборка (R8), декларация данных RuStore, удаление поля «Имя»,
ревизия Android unit-тестов.

**Что сделано:**
- **R8 / подписанный release**: добавлены keep/dontwarn-правила в `app/proguard-rules.pro` для Tink
  (`EncryptedSharedPreferences`): `-dontwarn com.google.errorprone.annotations.**`,
  `-keep class com.google.crypto.tink.**`, `-dontwarn com.google.api.client.http.**`,
  `-dontwarn org.joda.time.**` + стандартные retrofit/okhttp/okio. `minifyReleaseWithR8` зелёный.
- **Поле «Имя» убрано из регистрации** (нигде не использовалось): Android `RegisterScreen`/
  `AuthViewModel`/`AuthRepository.register` → `(email, password)`; `RegisterRequest` без `name`;
  `UserProfile.name` → nullable. Backend `/auth/register`: `name` опционально (`required:[email,password]`,
  `INSERT ... name ?? null`). Колонка `users.name` уже nullable. **Бэкенд-изменение → деплой.**
- **Тесты**: backend +1 (регистрация без имени) → **169/169**. Android unit-тесты: тест-КОД
  исправлен (сигнатуры `register`, конструкторы `Auth/ActionLog/TodayViewModel`,
  `AuthUiState.SuccessNoGarden`) — компилируется, но ЗАПУСК блокирован багом тулчейна (см. ниже).

**Найденные проблемы (зафиксированы в summary.md как E1–E3):**
- E1 — почта не верифицируется (нет SMTP; нет подтверждения email и сброса пароля).
- E2 — `POST_NOTIFICATIONS` не запрашивается в рантайме (на Android 13+ уведомления молча не идут).
- E3 — Android unit-тесты не запускаются: `testDebugUnitTest` → `ClassNotFoundException` на тест-классе
  (AGP 9.2.1 + built-in Kotlin не кладёт `transformDebugUnitTestClassesWithAsm/dirs` в classpath воркера).
  Рабочая проверка Android — `compileDebugKotlin`; логика покрыта backend-сьютом.

**RuStore-декларация данных** (для публикации): местоположение (приблизит./точное), email, ID пользователей,
ID устройства (push-токен), другой пользовательский контент, история покупок (статус подписки). «Имя» больше
НЕ собирается. Обоснование чувствительных разрешений — location ×2 + POST_NOTIFICATIONS.

**Сборка**: `compileDebugKotlin` ✅, `compileDebugUnitTestKotlin` ✅, `minifyReleaseWithR8` ✅,
backend `vitest` **169/169** ✅.

**Бэкенд ЗАДЕПЛОЕН** (HEAD `95e2e70`): `git fetch + reset --hard origin/main` + `pm2 restart dacha-api`
(без миграций/npm install — менялся только `auth.js`). Проверено вживую: `/health` ok,
`POST /auth/register` без `name` → 201 + token (user.name пустой).

**Состояние репозитория**: одна ветка `main` (== `origin/main`, HEAD `95e2e70`), рабочее дерево чистое.

**Незакрытые шаги для следующей сессии**: E1–E3 (бэклог), пересборка/проверка APK с актуального main
(имя убрано из регистрации, удалён блок быстрых действий, стрелка в Культурах, календарь без архивных работ).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (пятая: архив в календаре/действиях + стрелка «Культуры» + удаление быстрых действий)

**Темы**: утечки архивных (`stage='done'`) посадок в UI; навигация в «Справочнике культур»;
ревизия блока «Быстрые действия».

**Что сделано** (только Android, бэкенд НЕ затронут):
- **Календарь**: задачи из `/today` добавлялись на сегодня без проверки `donePlantingIds` — работы
  завершённого Томата всё равно показывались. Добавлен фильтр в `CalendarViewModel.buildEvents`
  (`task.plantingId in donePlantingIds → skip`). Клиентские поливы/уход уже фильтровались.
- **Стрелка «Назад» в «Культурах»**: `CropsScreen` получил параметр `onBack`, заголовок «Культуры»
  теперь в `Row` со стрелкой `ArrowBack` (как `CropDetailScreen`); в `MainActivity` передан
  `navController.popBackStack()`.
- **Архивные посадки в быстрых действиях**: `TodayViewModel` теперь кладёт в UI только
  `plantingsList.filter { it.stage != "done" }`.
- **Блок «Быстрые действия» удалён целиком** (по решению пользователя). Полив — единственное частое
  действие; подкормка/обработка требуют препарата, редки и уже всплывают как задачи дня с
  предзаполненным препаратом. Удалены `SunnyQuickActions`/`SunnyActionButton`/`PlantingPickerBottomSheet`,
  хелпер `onQuickAction`, стейт `showPlantingPicker`, coach-step `quick_actions`. ОСТАВЛЕНЫ
  `ActionLogBottomSheet` + стейты `selectedPlanting`/`quickActionType`/`quickActionNotes` — их
  переиспользуют карточки задач дня. Все действия теперь фиксируются через задачи дня и карточки посадок.

**Сборка `compileDebugKotlin` — зелёная.** Тесты backend не запускались (бэкенд не менялся).

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK + проверка на устройстве (Томат-архив не даёт работ
в календаре; стрелка возврата в «Культурах»; экран «Сегодня» без блока быстрых действий; запись
действия из карточки задачи дня по-прежнему работает).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (четвёртая: способ посадки + расписание/календарь)

**Темы**: предстоящие поливы в расписании посадки; не показывать работы завершённых культур в
календаре; способ посадки (рассада/прямой посев) и удаление стадии «Взошло».

**Что сделано** (детали — `summary.md`, `CONVENTIONS.md §9`):
- **Расписание работ**: добавлены ⚪ предстоящие поливы (`buildSchedule`), теплица ×0.8.
- **Календарь**: работы/напоминания/отложенные задачи завершённых посадок не показываются (`donePlantingIds`).
- **Способ посадки** (`plantings.sowing_method`, миграция `022`): выбор при создании/редактировании;
  прямой посев — без стадии/напоминания «Высажено в грунт», урожай по `harvest_days`; рассада — высадка
  → стадия `transplanted`. Стадия `sprouted` удалена. Гейты в `todayLogic.js`/`careRemindersJob.js`.

**Тесты backend 168/168**, `compileDebugKotlin` зелёная.

**Бэкенд ЗАДЕПЛОЕН** (HEAD `e736bdb`): миграции 018–022 применены, `dacha-api` перезапущен.
По 022: бэкофилл 8 direct / 7 seedling, `sprouted`=0. За сессию также задеплоено: промокоды
(+срок действия), грунт/теплица/полив/урожай, care_tasks для 45 культур + выверка тайминга.

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK с `main` (`e736bdb`) + проверка на устройстве всех
изменений сессии (промокоды, архив сезонов, ожидаемый урожай, поливы в расписании, календарь без
завершённых посадок, способ посадки/убранная «Взошло»).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (третья: грунт/теплица + количество)

**Тема**: проработка двух параметров посадки — тип (грунт/теплица) и количество.

**Что сделано** (детали — `summary.md`, блок «Параметры посадки»):
- **Единый расчёт полива** `wateringIntervalDays()` (`utils/todayLogic.js`): теплица → ЧАЩЕ (×0.8),
  вместо ×1.3 и трёх разных округлений (ceil/round/toInt). Зеркало в Android `CalendarViewModel`.
- **Теплица защищает от заморозков**: `frost_alert` в задачах дня не для `greenhouse`.
- **Ожидаемый урожай**: миграция `019` `crops.yield_per_plant_kg` (сидинг 44 культур),
  `GET /plantings(/:id)` отдаёт поле, строка «Ожидаемый урожай ~X кг» в «Информации о посадке».
- Решения пользователя: полив в теплице — ЧАЩЕ; quantity → ожидаемый урожай (новое поле culture).

**Тесты backend 165/165**, `compileDebugKotlin` зелёная.

**⚠️ Деплой**: применить миграцию `019_crop_yield.sql` (под postgres). Смена владельца не нужна
(только ALTER+UPDATE существующей таблицы crops).

**Незакрытый шаг**: пересборка APK + проверка (ожидаемый урожай в инфо-посадке, полив теплицы чаще).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (вторая: промокоды + архив сезонов)

**Состояние репозитория**: ветка `main` == `origin/main`, HEAD `e54ae43`. Рабочее дерево чистое.
Тесты backend **157/157**. CLI-сборка `compileDebugKotlin` — зелёная.

**Тема**: система промокодов (бесплатный доступ) + настоящий архив завершённых сезонов.

**Что сделано** (детали — `summary.md`, блок «промокоды + архив», и `CONVENTIONS.md §20`):
- **Промокоды**: миграция `017` (`users.promo_until` + таблица `promo_codes`), `POST /promo/redeem`
  (атомарный claim, 404/409), `access.js hasPromo`, `/auth/me` → `promo_active`/`promo_lifetime`.
  Два типа: `lifetime`/`month`. Скрипт `backend/scripts/gen-promo.js`. Бэкенд **задеплоен** (коды гасятся).
- **Android**: поле промокода на Paywall + интеграция в `SubscriptionManager`/`SettingsScreen`.
- **4 UX-фикса Paywall** (`e54ae43`): imePadding, тост-подтверждение, навигация по явному `accessGranted`
  (не по ambient-статусу), скрытие «Купить» при активном доступе.
- **Архив сезонов**: «Все» без `done`, чип «Завершённые».

**⚠️ Грабли деплоя промокодов**: после `psql -f 017_*.sql` (под postgres) таблица принадлежит postgres →
скрипт/приложение (dacha_user) ловят `permission denied for table promo_codes`. Лечится один раз:
`sudo -u postgres psql -d dacha_db -c "ALTER TABLE promo_codes OWNER TO dacha_user;"`.

- **Срок действия промокодов (доработка)**: миграция `018` (`duration_days` + `expires_at`),
  `redeem` → 410 для истёкших, произвольный срок `days N` в скрипте, дедлайн `--expires`.
  Дата окончания доступа в Настройках/Paywall; «Купить» снова доступна во время промо. Тесты **160/160**.

**⚠️ Деплой 018**: применить `018_promo_codes_expiry.sql` (под postgres — DDL/ALTER пройдут).
Новой смены владельца не требуется (колонки наследуют владельца таблицы).

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK + проверка на устройстве (промокоды: ввод/тост/
статус с датой/клавиатура/«Купить» во время промо/истёкший код; архив сезонов).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-04 (первая: просрочка ухода)

**Состояние репозитория**: одна ветка `main` (== `origin/main`, HEAD `ddbf40e`). Рабочее дерево
чистое. VPS выровнен на `origin/main` (вчерашний merge-коммит убран через `reset --hard`).

**Тема сессии**: просрочка ухода на экране «Посадки» + связанные доработки. **Бэкенд задеплоен**
на dacha-api (новый деплой-регламент `git fetch + reset --hard origin/main`, pm2 restart, проверено
живым `GET /plantings`). Сьют **147/147**. CLI-сборка `compileDebugKotlin` — зелёная.

**Что сделано** (детали — в `summary.md`, блок 2026-06-04):
- `GET /plantings` отдаёт `overdue_care_task {name, days_overdue, product}` по каждой посадке
  (`getOverdueCareTask`) → care-просрочки видны на карточках, не зависят от кэша «Сегодня».
- Снятие pending только при закрывающем типе; маппинг care-имён по ключевому слову + тип `treatment`
  (+ в SQL-фильтрах); препарат обработки (`CARE_TASK_PRODUCT`); реактивная заметка (`auto=false`).
- Бейдж «Посадки» из серверных данных (`saveAttentionCount`); «Сегодня» по ON_RESUME; раскраска
  расписания в «Информации о посадке»; UI-полиш (отступ снизу, эмодзи в меню).
- **Git-модель**: VPS — read-only зеркало `origin/main`, деплой `fetch + reset --hard` (НЕ `pull`).

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK с `main` (`ddbf40e`) + проверка на устройстве
(просрочка/препарат на карточках, заметка, бейдж, раскраска расписания, отступ снизу).

### Как продолжить в следующей сессии
1. `cd "C:\Projects\Dacha\Календарь дачника"` → стартовать Claude.
2. Прочитать (по CLAUDE.md): `summary.md`, этот `session-note.md` (сверху), `android/CONVENTIONS.md`
   (§12 деплой, §16–19 — паттерны care/заметок/бейджа), при коде — `TESTING.md`.
3. Новую задачу от `main`: `git checkout -b feature/<name>` → commit →
   `git checkout main && git merge --ff-only feature/<name>` → push.
4. **Деплой backend** (новый регламент): `ssh hetzner` → `cd /var/www/dacha-api &&
   git fetch origin && git reset --hard origin/main` → `cd backend && npm install` (если менялся
   package.json) → миграции `sudo -u postgres psql -d dacha_db -f .../0XX.sql` → `pm2 restart dacha-api`.
   Деплоим ТОЛЬКО dacha-api. **Не `git pull`** (создаёт merge-коммит).
5. Тесты backend: `npx vitest run`. Сборка Android: `$env:JAVA_HOME=...jbr;
   $env:ANDROID_HOME=...Sdk; .\gradlew.bat :app:compileDebugKotlin` (PowerShell).

---

## ЗАКРЫТИЕ СЕССИИ 2026-06-03

**Состояние репозитория**: одна ветка `main` (== `origin/main`, коммит после `chore(gitignore)`).
Все стейл-ветки удалены локально и на origin. Рабочее дерево чистое. `.claude/` в `.gitignore`.

**Что сделано** (детали — в блоках ниже по файлу): серверный триал (014) + серверный гейт
платных действий (016, requireAccess→402) + синк подписки с клиента; push-дайджест;
группировка однотипных care-задач; фиксы (pending только при записи; просроченные care не выпадают
из /today; «Рыхление» в селекторе; автоподстановка города под полем; реактивный бейдж);
консистентность (Material Icons в журнале/селекторе, чистка эмодзи в рекомендациях, серверный
флаг `auto`); a11y hero; сворачиваемый прогноз; актуализация CLAUDE.md.

**Backend задеплоен** на dacha-api (миграции 014/015/016 применены, pm2 restart, проверено).
Сьют **123/123**.

**ЕДИНСТВЕННЫЙ незакрытый шаг**: пересборка APK в Android Studio + проверка Android-изменений
на устройстве (логин-триал, гейт 402 после истечения, бейдж, иконки, автоподстановка города,
сворачиваемый прогноз). CLI-сборка `compileDebugKotlin` — зелёная.

### Как продолжить в следующей сессии
1. `cd "C:\Projects\Dacha\Календарь дачника"` → стартовать Claude.
2. Прочитать (по CLAUDE.md): `summary.md` (статус/бэклог), этот `session-note.md` (сверху),
   `android/CONVENTIONS.md` (§16–17 — новые паттерны), при коде — `TESTING.md`.
3. Новую задачу начинать от `main`: `git checkout -b feature/<name>`. Процесс: commit →
   `git checkout main && git merge --ff-only feature/<name>` → push обеих → VPS тянет main.
4. Деплой backend: `ssh hetzner` (PowerShell) → `cd /var/www/dacha-api && git pull origin main`
   → `cd backend && npm install` → миграции `sudo -u postgres psql -d dacha_db -f .../0XX.sql`
   → `pm2 restart dacha-api`. Деплоим ТОЛЬКО dacha-api.
5. Тесты backend: `npx vitest run` (мок-БД). Сборка Android: `$env:JAVA_HOME=...jbr;
   $env:ANDROID_HOME=...Sdk; .\gradlew.bat :app:compileDebugKotlin` (PowerShell).

---


---

## Сессия — Solar Dacha UI · 2026-06-02

### Что сделано

#### Дизайн-система Solar Dacha
- Создан `UI_MANIFEST.md` — технические правила Compose-кода (отступы, кнопки, типографика)
- Установлен скилл `ui-ux-pro-max`, сгенерирован `design-system/` с MASTER.md + 14 page-файлов
- Подключён MCP-сервер `shadcn-ui` (46 компонентов, tweakcn темы)
- HTML-прототипы 4 вариантов дизайна → утверждён **Solar Dacha** (Nunito Black, оранжевый градиент hero, кремовый фон)
- Скачаны и бандлированы шрифты: Nunito (400/600/700/800/900) + Russo One в `res/font/`

#### Реализация Solar Dacha в Compose
- **Theme.kt**: новая палитра — `primary #FF7B00`, `background #FFF8EB`, `tertiary #2E7D32`
- **Type.kt**: `NunitoFamily` + `RussoOneFamily` из локальных TTF (без Google Fonts provider)
- **TodayScreen**: полный редизайн — diagonal clip hero, анимированный подсолнух, staggered section titles, gradient action buttons, square aspect-ratio кнопки
- **Все 13 UI-экранов** переведены на Solar Dacha: Nunito Black заголовки, pill-FilterChips, rounded-22dp карточки
- Все `FontWeight.Normal/Medium` → `Bold/SemiBold` во всех экранах

#### Баг-фиксы UI
- Дата в hero: реальная из системы в формате "ПОНЕДЕЛЬНИК · 2 ИЮНЯ" (полная, uppercase)
- Text-shadow на заголовке hero
- Карточки: явный `Color.White` вместо `surface` (убирает Material3 orange tint при elevation)
- Бейдж стадии посадки: перенесён в правый верхний угол карточки как pill
- Иконка "Обработал": `BugReport` → `HealthAndSafety`
- Кнопки быстрых действий: квадратные (`aspectRatio(1f)`)
- Иконки рекомендаций: 44dp, 25% opacity — насыщеннее
- Добавлены типы рекомендаций: `lunar_tip`, `stage_tip`, `seasonal_tip`, `sowing_season` и др.

#### Баг-фиксы логики
- Двойная шторка при клике на задачу — убрано (`onQuickAction` не вызывается из task-карточки)
- `care_task_due` передаёт название задачи в `notes` при логировании
- `PENDING_ACTION_LABELS`: добавлен `care_task_due` → "Требуется: {название}"
- Бэкенд `todayLogic.js`: окно care_task `+3` → `0` дней (только сегодня/просроченные)
- **Dismissed рекомендации**: персистятся в SharedPreferences с датой → после рестарта не возвращаются; на следующий день — снова показываются

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

---

## Сессия 2026-06-01 (продолжение) — Большая сессия пост-MVP

### Сделано

**Пункты "Важно" (5–10)**
- OnboardingCropsScreen — выбор культур после создания участка (grid 3 cols)
- Тип участка (грунт/теплица/смешанный), migration 010_garden_type
- Фильтр посадок по стадии (LazyRow chips, filteredPlantings в UiState)
- Push transplant_due (careRemindersJob + sendTransplantAlert + Settings toggle)
- JournalScreen + JournalViewModel — все действия по датам, фильтр по культуре
- История действий в PlantingInfoBottomSheet (20 шт. с заметками)

**Рекомендации**
- 6 категорий: watering/frost/harvest (агрономические) + heat_stress + weather_tip (погодные) + lunar_tip + seasonal_tip + stage_tip + lifehack (информационные)
- Сезонные подсказки "пора сажать" с учётом климатической зоны (getDayOfYear + getZoneDayOffset)
- Photon API для автодополнения городов (замена Nominatim, который не поддерживает префиксный поиск)

**Guided flow / стадии**
- care_tasks → задачи дня (тип care_task_due, окно -1..+3 дня), лимит 5→7
- Стадия `transplanted` добавлена в STAGE_ORDER между sprouted и growing
- "Следующий шаг" на карточке посадки (next_care_task: {name, days_until})
- Свайп для удаления рекомендации (SwipeToDismissBox)

**Участок и геолокация**
- City field: migration 012_garden_city — теперь сохраняется и предзаполняется
- GPS без Google Play Services (LocationManager, таймаут 15 сек)
- Автодополнение города через Photon (Flow.debounce 400мс в ViewModel)
- Климатическая зона автоопределяется из Nominatim address.state (85 субъектов РФ)
- 85 регионов в выпадающем списке с поиском (RegionInputField)
- Город обязателен; регион опционален

**Аутентификация и данные**
- Выход из аккаунта в Настройках (AlertDialog + tokenStorage.logout())
- AuthViewModel: после логина вызывает loadGardens() → восстанавливает gardenId
- LoginScreen: SuccessHasGarden → Today, SuccessNoGarden → CreateGarden
- GET /gardens: ORDER BY planting_count DESC (участок с данными — первый)
- POST /gardens: лимит 3 участка на аккаунт (409 если превышен)
- Удалён spurious garden id=6 (пустой, созданный при повторном онбординге)

**Баг-фиксы**
- Сортировка расписания работ по LocalDate (не строкой DD.MM.YY)
- careRemindersJob: исправлено имя колонки watering_frequency_days → watering_freq_days
- Тесты обновлены (лимит задач 5→7, 55/55 passed)

### Технические решения
- Дебаунс автодополнения: Flow.debounce в ViewModel, а не LaunchedEffect+delay в Compose (надёжнее)
- Рекомендации, отклонённые свайпом: Set<String> в TodayViewModel, не сохраняется между сессиями
- GeocodeSuggestion.zone — климатическая зона из ответа Photon через NOMINATIM_TO_ZONE mapping


---

## Сессия 2026-06-02 (ветка feature/ux-improvements)

### Шаг 1 — развести «Задачи» и «Советы дня» (устранение дублирования контента)
**Проблема**: экран Today грузит `tasks` (GET /today) и `recommendations` (GET /recommendations)
и рендерит оба списка. Полив/заморозки/готовый урожай присутствовали в ОБОИХ → один и тот же
пункт показывался дважды (в «Задачах» и в «Советах дня»), с раздельными машинами snooze/delete.

**Изменение** (`backend/src/routes/recommendations.js`):
- Удалены actionable-типы, дублирующие задачи: `watering`, `frost_alert`, `harvest_ready`.
- Эндпоинт стал чисто информационным/контекстным. Оставлены: `heat_stress` (полив вечером),
  `harvest_soon` (подготовить тару), `stage_tip`, `weather_tip` (после дождя),
  `lunar_tip`, `seasonal_tip`, `lifehack`, `sowing_season`/`sowing_soon`.
- Actionable-пункты (полив/заморозки/урожай готов) теперь живут ТОЛЬКО в GET /today (tasks).

**Android**: изменений не потребовалось — карточка рекомендации имеет fallback по типу;
неиспользуемые маппинги (watering/frost_alert/harvest_ready в REC_TYPE_LABELS/recStyle) безвредны.
Раздельные машины snooze/delete (tasks ↔ recs) оставлены: после дедупликации это разный контент,
конфликта больше нет.

**Проверка**: `node --check` OK; кириллица цела; дубль-типы отсутствуют (grep = 0); тестов на
recommendations нет, прочий тест-сьют не затронут. Не задеплоено (по запросу — только ветка).

### Шаг 2 — вернуть вход в «Статистику» + оживить экспорт CSV
**Проблема**: экран `AnalyticsScreen` (серия дней, график за 30 дней, прогресс онбординга,
кнопка экспорта истории в CSV) был зарегистрирован в NavHost, но НИ ОДНА кнопка не вызывала
`navigate(Screen.Analytics)` → экран и единственный вход к экспорту CSV были недостижимы.

**Изменения**:
- `ui/settings/SettingsScreen.kt`: новый параметр `onOpenAnalytics`; добавлена секция «ДАННЫЕ»
  с карточкой-входом «Статистика и история» (иконка Insights, → Analytics).
- `ui/analytics/AnalyticsScreen.kt`: добавлены `onBack` + TopAppBar с кнопкой «Назад»;
  убран дублирующий инлайн-заголовок «Статистика» (теперь он в шапке).
- `MainActivity.kt`: проброшены `onOpenAnalytics` в Settings и `onBack` в Analytics.
- `navigation/Navigation.kt`: `Screen.Analytics.route` добавлен в `screensWithoutBottomBar`
  (экран открывается как focused, без нижней панели, с «Назад»).

Путь: Today → шестерёнка (Настройки) → «Статистика и история» → Analytics (+ экспорт CSV).
**Проверка**: `:app:compileDebugKotlin` — BUILD SUCCESSFUL.

### Шаг 3 — разгрузка экрана Today
Уточнение: дубля температуры (Hero ↔ WeatherDetailsCard) по факту нет — карточка погоды
показывает влажность/почву/осадки + прогноз, отдельной «сегодняшней» температуры там нет.
Реальная перегрузка — длинный список «Советов дня» (после Шага 1 он информационный:
лунный/сезонный/лайфхак/посев — до ~8 карточек).

**Изменение** (`ui/today/TodayScreen.kt`): «Советы дня» показывают первые 3, ниже —
кнопка «Показать ещё (N)» / «Свернуть» (state recsExpanded). Coach-marks не затронуты
(их индекс ссылается только на наличие секции recs, не на число карточек).
**Проверка**: compileDebugKotlin — BUILD SUCCESSFUL.

### Шаг 4 — нижняя навигация: ОТЛОЖЕНО (нужно продуктовое решение)
Перестройка табов (Урожай → внутрь Посадок; добавить Справочник/Статистику в навбар) меняет
привычные пути и требует решения по аналитике использования — не делаю автономно.

### Шаг 5 — единообразие (часть 1: дизайн-документация)
`design-system/календарь-дачника/` был авто-сгенерирован скиллом под ОШИБОЧНУЮ категорию
(community/social, неоновый gaming-стиль), не соответствовал реальному «Solar Dacha» и
вводил в заблуждение.
- `MASTER.md` переписан: краткое описание Solar Dacha + указатель на UI_MANIFEST.md + Theme.kt.
- `pages/*.md` (14 файлов) удалены.
- ⚠️ `CLAUDE.md` UI-флоу всё ещё ссылается на удалённые pages — правка заблокирована политикой
  (само-модификация конфига агента), нужно поправить вручную.
- Не сделано: единообразие иконок (эмодзи в JournalScreen → Material Icons) — отложено.

## P0 — Безопасность

### IDOR — проверка владельца на write-эндпоинтах
Закрыты 6 мест, где ресурс менялся/создавался без проверки принадлежности пользователю:
- `plantings.js`: POST / (garden_id не свой → 403), PATCH /:id/stage, PATCH /:id/info
  (UPDATE ... WHERE id AND garden_id IN (SELECT ... WHERE user_id=)).
- `actions.js`: POST / (planting_id не свой → 403).
- `harvests.js`: POST / (planting_id не свой → 403).
- `reminders.js`: POST / (если planting_id задан — он должен быть свой → 403).
Паттерн как в уже существовавших DELETE /actions/:id и DELETE /plantings/:id.

**Тесты**: обновлён мок успешного POST /plantings (учёт запроса проверки владельца) +
добавлен тест «403 при создании посадки в чужом участке (IDOR)». Интеграционные
плантинги/actions/harvests/reminders — 29/29 зелёных.

⚠️ **Предсуществующая поломка (не моя)**: `src/__tests__/unit/todayLogic.test.js` — 21 тест
падает, т.к. вызывает `buildTasks` со старой сигнатурой (5 арг.) вместо текущей (8 арг.:
добавлены lastFertilizedMap, careActionsToday, precipProb). `todayLogic.js` я не трогал.
Нужно отдельно обновить этот юнит-тест под актуальную сигнатуру.

### JWT, rate-limit, helmet, CORS (app.js)
- JWT: добавлен `sign.expiresIn` (JWT_EXPIRES_IN || 30d) — токены больше не вечные.
- JWT_SECRET: в production сервер падает при старте, если секрет не задан (раньше — тихий
  дефолтный ключ).
- `@fastify/helmet` — security-заголовки.
- `@fastify/rate-limit` — глобальный лимит (RATE_LIMIT_MAX || 100/мин) + строгий на
  /auth/login и /auth/register (10/мин) против брутфорса.
- CORS: конфигурируемый через CORS_ORIGIN (по умолчанию — прежнее поведение, любой origin).
- `.env.example`: добавлены CORS_ORIGIN, RATE_LIMIT_*, починена битая кириллица в комментариях.
- Зависимости: @fastify/rate-limit@9, @fastify/helmet@11.
Полный сьют: 76 зелёных; красны только прежние 21 todayLogic (не моё, см. выше).

### Починка todayLogic.test.js (предсуществующая поломка)
Тест вызывал buildTasks со старой 5-арг сигнатурой. Во все вызовы вставлен `{}`
(lastFertilizedMap, поз. 4) под актуальную 8-арг сигнатуру. Сьют полностью зелёный: 97/97.

### Гигиена git (P1)
- `.gitignore`: добавлены backend/coverage/, android/app/release/ (APK 5.5М), android/local.properties.
- Сняты с трекинга: backend/coverage/** (сгенерированный отчёт), android/local.properties.
  (рабочие файлы на диске сохранены — git rm --cached).

### P1 — токен в зашифрованном хранилище (EncryptedSharedPreferences)
`TokenStorage`: токен теперь в EncryptedSharedPreferences ("dacha_secure_prefs"), а не в
открытом dacha_prefs. Миграция: старый токен из dacha_prefs переносится в зашифрованное и
удаляется из открытого при первом доступе. Защитный фолбэк: если keystore недоступен/повреждён —
деградируем до обычных prefs (вход не падает). logout() чистит оба хранилища.
Зависимость: androidx.security:security-crypto 1.1.0-alpha06. ✅ compileDebugKotlin.
Примечание: сборка из CLI требует ANDROID_HOME (local.properties теперь gitignored).

### Шаг 4 — перестройка нижней навигации + CLAUDE.md
- Нижний таб-бар: Сегодня · Календарь · Посадки · **Информация** (был «Урожай»).
- «Урожай» убран из таб-бара: вход — кнопка «Урожай» в шапке «Посадок»; экран стал
  pushed (добавлен TopAppBar + «Назад»), внесён в screensWithoutBottomBar.
- Новый таб **«Информация»** (`Screen.Info`) → `InfoHubScreen`: хаб с карточками
  «Справочник культур» (→ Crops) и «Статистика» (→ Analytics).
- `CLAUDE.md`: раздел UI/UX Flow переписан — источник правды UI_MANIFEST.md + Theme.kt,
  ссылки на удалённые design-system/pages убраны (правка разрешена пользователем).
- Запись «Статистика и история» в Настройках оставлена (доп. вход + контекст экспорта).
✅ compileDebugKotlin BUILD SUCCESSFUL.

### GRANT care_alert_log + текст подкормки
- Прод: выдан GRANT SELECT/INSERT/UPDATE/DELETE на care_alert_log + USAGE,SELECT на
  care_alert_log_id_seq для dacha_user — careRemindersJob больше не падает на правах.
- `todayLogic.js`: заголовок подкормки теперь «Подкормить <культура> (<продукт>)» вместо
  «Подкормить: <продукт>» (было неясно, какое растение). 97/97 тестов зелёные.

---

## NEXT (новая сессия): Серверный триал (P1)

**Проблема**: 7-дневный триал считается на клиенте (`TokenStorage.isTrialActive()` от
`first_launch_date` в SharedPreferences) и обходится сбросом данных/переустановкой.
Перенести на сервер, привязав к user_id.

**Чек-лист подзадач**:
1. [ ] Миграция `0XX_user_trial.sql`: `ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMPTZ`
   (DEFAULT NOW() для новых; бэкофилл существующим — например, created_at). Опц. вычислять
   trial_ends_at = trial_started_at + 7 дней на лету.
2. [ ] `routes/auth.js`: при register проставлять trial_started_at; в `GET /auth/me` отдавать
   `trial_started_at`, `trial_active` (bool), `trial_days_left` (int).
3. [ ] (Опц.) гейтить платные действия на сервере, если триал истёк и нет подписки —
   но подписка проверяется в RuStore на клиенте, так что минимум: сервер = источник правды
   по триалу, клиент его читает.
4. [ ] Android `Models.kt`: добавить поля в модель /auth/me. `SubscriptionManager` берёт
   isTrialActive/trialDaysLeft с сервера (через AuthRepository.me), а не из TokenStorage.
   Локальные `isTrialActive/trialDaysLeft/getFirstLaunchDate` в TokenStorage — выпилить или
   оставить как офлайн-фолбэк.
5. [ ] Тесты backend (vitest, мок-БД): /auth/me возвращает trial_active/days_left корректно;
   register ставит trial_started_at.
6. [ ] Деплой: миграция `sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/0XX_*.sql`,
   затем `cd /var/www/dacha-api && git pull origin main && cd backend && npm install && pm2 restart dacha-api`.

**Окружение**: backend-тесты `npx vitest run`; Android-сборка — `$env:JAVA_HOME=...jbr`,
`$env:ANDROID_HOME=...Sdk`, `gradlew.bat` через PowerShell. SSH `ssh hetzner` только из PowerShell.
Деплой ТОЛЬКО dacha-api (не landing-factory). Кириллица в .js — Write/Edit, не Set-Content.

---

## Сессия 2026-06-03 — Серверный триал (P1) ✅

Триал перенесён с клиента на сервер, привязка к `user_id`. Процесс: коммит в
`feature/ux-improvements`, ff `main`, push обе, VPS тянет `main`.

**Backend (commit 268ef15):**
- Миграция `014_user_trial.sql`: `users.trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  бэкофилл существующим = `created_at`.
- `routes/auth.js`: константа `TRIAL_DAYS=7` + хелпер `trialInfo()`. `POST /register` и
  `GET /auth/me` отдают `trial_active` (bool) и `trial_days_left` (int).
- Тесты `auth.test.js`: +2 кейса (/me свежий триал → active/7; старше 7 дней → inactive/0),
  register проверяет триал-поля. Сьют 99/99 зелёный.
- Деплой: миграция применена (3 юзера бэкофилл), `pm2 restart dacha-api`. Проверено живьём:
  `/auth/me` (user 2) → `trial_active:true, trial_days_left:2`.

**Android (Этап 4):**
- `Models.kt UserProfile`: + `trialActive`/`trialDaysLeft` (nullable-дефолты — login отдаёт без них).
- `AuthRepository.me()` → `Result<UserProfile>` (новый метод, в CONVENTIONS.md §репозитории).
- `SubscriptionManager.refresh()`: триал берётся с сервера через `authRepository.me()`;
  при сетевой ошибке (Result не Success) — офлайн-фолбэк на `TokenStorage`. Локальные
  `isTrialActive/trialDaysLeft` в TokenStorage оставлены как фолбэк. ✅ compileDebugKotlin.

### Единообразие иконок — JournalScreen
- `JournalScreen.kt`: убраны эмодзи из `ACTION_LABELS` (теперь plain-метки «Полив», «Подкормка»…).
- Добавлен `actionIcon(type)` — Material Icons в единой лексике с TodayScreen
  (WaterDrop/Eco/HealthAndSafety/Grass/ContentCut/Spa). В карточке записи — ведущая иконка
  (primary, 20dp) + текст. `isAutoGeneratedNote` использует plain-метки как раньше.
- Осталось (вне правки): `ACTION_TYPES` в ActionLogBottomSheet — эмодзи-чипы в селекторе
  (отдельный визуальный паттерн); inline-эмодзи в recommendations.js; backend `auto`-флаг
  вместо строкового isAutoGeneratedNote. ✅ compileDebugKotlin.

### Push-дайджест — careRemindersJob (борьба со спамом)
**Проблема**: джоб слал отдельный пуш на КАЖДУЮ просроченную посадку (id уведомления =
`messageId.hashCode()` → не схлопываются), при 8 посадках = 8 пушей × до 3 типов.
**Решение (backend-only, без изменения клиента)**: один сводный пуш на участок на тип.
Существующие `type` (watering_due/fertilizing_due/transplant_due) сохранены → deep-link и
настройки уведомлений на установленных клиентах не меняются, APK обновлять не нужно.
- `pushService.js`: заменил `sendWateringAlert/Fertilizing/Transplant` на digest-версии
  (`sendWateringDigest/Fertilizing/Transplant` + общий `sendCareDigest`). Тело: «Полейте:
  Томат, Огурец и ещё 2» (`listCrops`, max 3 + хвост). frost/heat не трогал.
- `careRemindersJob.js`: собирает просроченные в корзины по участку/типу, шлёт один дайджест
  на тип, помечает каждую вошедшую посадку в `care_alert_log` (дедуп на день сохранён).
  `runCareReminders(db, push=pushService)` — push внедряется параметром (DI для тестов;
  `vi.mock` не перехватывал CJS-деструктуризацию). Экспортирован `runCareReminders`.
- Тест `careRemindersJob.test.js` (4 кейса): батчинг двух посадок в один пуш, дедуп,
  подкормка, пересадка. Сьют 103/103. Задеплоено на dacha-api.

### Accessibility — hero TodayScreen (аудитория 50+)
Ревью: дата 11sp белым alpha .80 на оранжевом #FF7B00 → ~2.6:1 (ниже WCAG AA).
Оранжевый hero — часть бренда (полный AA на нём недостижим без смены дизайна),
поэтому максимизирую читаемость:
- `SunnyHero` дата: 11sp→13sp, alpha .80→полный белый, + мягкая тень (Shadow 0x55000000).
- Иконки шапки (Edit/Settings): tint .85→полный белый; зона нажатия 36dp→44dp;
  добавлены `contentDescription` («Изменить участок»/«Настройки») вместо null — для TalkBack.
✅ compileDebugKotlin. Требует пересборки APK.

### Баг-фикс — pending-задача пропадала при отмене шторки действия
**Симптом**: открыть «Записать действие» на карточке посадки и закрыть БЕЗ записи →
индикатор просроченной задачи на карточке исчезал, но бейдж-счётчик продолжал считать;
после рестарта задача возвращалась.
**Причина**: `PlantingsViewModel.closeActionSheet()` снимал pending (`pendingTasks - id` +
`savePendingTasks`) при ЛЮБОМ закрытии шторки, в т.ч. при отмене. Карточка читает
in-memory `uiState.pendingTasks` (обновлялась мгновенно), бейдж — `getPendingCount()` из
prefs (рекомпозится только при навигации) → рассинхрон. На рестарте `/today` пере-сохранял
pending с сервера (действие не записано) → задача возвращалась.
**Фикс**: pending снимается только при РЕАЛЬНО записанном действии.
- `ActionLogBottomSheet`: новый колбэк `onActionLogged` — вызывается в `LaunchedEffect(success)`
  перед `onDismiss` (по умолчанию `{}`, поведение TodayScreen не меняется).
- `PlantingsViewModel`: новый `onActionLogged(plantingId)` снимает pending + персистит;
  `closeActionSheet()` больше pending не трогает (только закрытие + silent reload + снуз).
- `PlantingsScreen`: прокинут `onActionLogged = { viewModel.onActionLogged(planting.id) }`.
Теперь отмена ничего не меняет (карточка и счётчик согласованы); запись действия снимает
индикатор и на сервере (на рестарте не возвращается). ✅ compileDebugKotlin. Пересборка APK.

### Баг-фикс #1 — «Рыхление» отсутствовало в селекторе действий
`ACTION_TYPES` (ActionLogViewModel) не содержал `loosening`, хотя `careTaskActionType`
маппит «Рыхление» → `loosening`. При тапе по care-задаче «Рыхление» предвыбор не находил
кнопку. Добавлен `"loosening" to "🪏 Рыхление"`. ✅ compileDebugKotlin. Пересборка APK.

### Баг-фикс #2 — просроченная care-задача выпадала из задач дня
**Симптом**: просроченное действие, видимое на карточке «Посадок», не показывалось в
задачах дня.
**Причина**: в `buildTasks` care-задача добавлялась только в окне `diff >= -1 && diff <= 3`
(нижняя граница -1) — просрочка >1 дня терялась. Полив/подкормка/пересадка такого
ограничения не имеют (показываются пока не выполнены).
**Фикс** (`todayLogic.js`): нижняя граница убрана — care-задача показывается с +3 дней до
наступления и ПОКА не выполнена. «Выполнено» = соответствующее действие (по
`CARE_TASK_ACTION_MAP`) залогировано в день наступления задачи или позже (а не только
сегодня — иначе повторный наг). Новый параметр `lastCareActionMap` (9-й, дефолт `{}`).
- `today.js`: собирает `lastCareActionMap` (DISTINCT ON planting_id, action_type — последняя
  дата каждого care-действия) и передаёт в buildTasks.
- Тесты: +6 кейсов на care_task_due (регресс окна, выполнено до/после наступления,
  окно +3, careActionsToday). Сьют 109/109. Задеплоено на dacha-api.
- Проверено на проде (user 2, garden 4): care-задачи с просрочкой 16/9/6/3 дн. теперь в
  задачах дня (раньше >1 дн. выпадали).

### Реактивный бейдж pending-задач (BottomNav)
`MainActivity` читал `tokenStorage.getPendingCount()` нереактивно → бейдж обновлялся только
при навигации (после записи действия счётчик «отставал»).
- `TokenStorage`: добавлен `pendingCount: StateFlow<Int>` (@Singleton), обновляется в
  `savePendingTasks` / `snoozeTask` / `logout` через `refreshPendingCount()`; инициализация
  в `init`.
- `MainActivity`: `val activePlantings by tokenStorage.pendingCount.collectAsState()` вместо
  разового чтения. Теперь бейдж синхронен с карточками. ✅ compileDebugKotlin. Пересборка APK.

### Серверный флаг `auto` вместо строковой эвристики isAutoGeneratedNote
**Проблема** (тех-долг из ревью): авто-подставленная заметка (имя care-задачи/удобрения при
логировании из задачи дня) скрывалась в журнале хрупкой строковой эвристикой
`isAutoGeneratedNote` — она сверяла заметку с шаблоном `"label: crop"`, но реальная авто-заметка
= просто имя задачи («Рыхление») → эвристика НЕ срабатывала (дубль всё равно показывался). Плюс
эвристика дублировалась в JournalScreen и TodayScreen и ломалась при смене меток (ACTION_LABELS).
**Решение** — явный флаг на сервере:
- Миграция `015_action_auto_flag.sql`: `action_logs.auto BOOLEAN NOT NULL DEFAULT false`.
- `actions.js` POST: принимает `auto` (default false), пишет в БД. GET отдаёт через `al.*`.
- Android: `ActionLog`/`CreateActionRequest` + `auto`; `ActionsRepository`/`ActionLogViewModel.logAction(..., auto)`.
- `ActionLogBottomSheet`: `auto = !initialNotes.isNullOrBlank() && notes == initialNotes`
  (заметка осталась авто-подставленной, юзер не менял).
- `JournalScreen` и `TodayScreen`: показывают заметку по `!action.auto`; удалены обе копии
  `isAutoGeneratedNote` и `ACTION_LABELS_PLAIN`.
- Тесты: +2 (actions POST сохраняет auto=true / default false). Сьют 111/111.
Старые записи: auto=false → их заметки показываются как раньше (эвристика их и так не скрывала).
✅ compileDebugKotlin. Задеплоено на dacha-api. Пересборка APK.

### Inline-эмодзи в recommendations.js (единообразие)
Карточка рекомендации уже рисует Material-иконку по типу (recStyle: heat_stress→WbSunny,
sowing→CalendarMonth). Ведущие эмодзи в тексте дублировали её. Убраны: `🌡️` (heat_stress),
`🌱` (sowing_season ×2), `📅` (sowing_soon ×2). Курируемые тексты в `data/tips`
(WEATHER_TIPS/stage/seasonal/lifehack) эмодзи не содержат. `lunar.label` (🌘 — фаза луны)
оставлен: глиф информативен (разные фазы). Backend-only, node --check OK. Задеплоено на dacha-api.

### Селектор действий (ActionLogBottomSheet) — Material Icons вместо эмодзи
Последний эмодзи-островок. `ACTION_TYPES` → plain-метки. Создан общий
`ui/actions/ActionVisuals.kt` с `actionIcon(type)` (тот же маппинг, что был в JournalScreen) —
единый источник для селектора и журнала. Кнопки пикера: ведущая Icon(18dp)+текст.
`JournalScreen` теперь импортирует общий `actionIcon` (локальная копия + её иконочные импорты
удалены). Эмодзи в UI действий не осталось. ✅ compileDebugKotlin. Пересборка APK.

### CLAUDE.md — актуализация под реальный процесс (с разрешения)
4 расхождения исправлены:
1. Deploy SSH-хост `ssh eugenekrukov@dacha.studio1008.com` → `ssh hetzner` (только PowerShell).
2. Миграции: канон — `sudo -u postgres psql -d dacha_db -f .../0XX.sql` (DDL/GRANT требуют
   суперюзера; `npm run migrate` под dacha_user не имеет прав). Добавлены команды тестов/сборки.
3. File Writing Rules: Write tool — основной (UTF-8); Edit — мелкие правки (в т.ч. кириллица);
   SSH heredoc — на VPS; PowerShell Set-Content — никогда. (Было: «Edit — never, cat>EOF — всё».)
4. Git Workflow: добавлен флоу feature→ff main→push обеих→VPS тянет main; «деплой только dacha-api».
UI/UX Flow уже был корректен (память про BLOCKED устарела).

### Группировка однотипных care-задач в задачах дня
**Проблема**: после фикса просрочки care_task_due (приоритет 3 > полив 4) много однотипных
care-задач разных посадок вытесняли полив/урожай из топ-7.
**Решение** (`todayLogic.js`): care-задачи копятся в `careAccum`, после цикла группируются по
`care_task_name`. Одиночная (1 посадка) → остаётся адресной (planting_id сохранён, tappable,
индикатор «Требуется» на карточке). Группа (N>1) → одна карточка `planting_id=null`,
`crops:[...]`, заголовок «Прополка: Томат, Огурец и ещё 2» (`listCrops`, max 3),
`days_overdue=max`. Групповые информационные (не tappable; логировать с экрана «Посадки»).
formatTasks: заголовок care_task_due учитывает `crops`. +4 теста (группировка/одиночная/
разные имена не сливаются). todayLogic 30/30. Клиент менять не нужно (заголовок с сервера,
planting_id=null → карточка не кликается). Трейд-офф: у посадок в группе пропадает красный
индикатор «Требуется» (он берётся из per-planting задач /today) — инфо есть на Today.

### Серверный гейт платных действий (триал/подписка)
**Задача**: после окончания триала и без подписки блокировать платные действия на сервере
(защита глубже клиентского paywall). Нюанс: подписка валидируется в RuStore на КЛИЕНТЕ —
сервер о ней сам не знает. Решение: клиент синхронизирует статус, сервер хранит окно.
- Миграция `016_user_subscription.sql`: `users.subscription_until TIMESTAMPTZ`.
- `utils/access.js` (общий): `TRIAL_DAYS`, `trialInfo`, `isSubscribed`, `hasAccess` (триал
  активен ИЛИ подписка активна). auth.js теперь импортирует trialInfo оттуда (убрал дубль).
- `POST /auth/subscription {active}`: active → `subscription_until = now + 7 дн` (скользящее окно,
  клиент продлевает при каждом запуске); !active → null. `/auth/me` отдаёт `subscribed`.
- `app.js`: декоратор `requireAccess` (jwtVerify → SELECT user → hasAccess → иначе **402**
  `subscription_required`).
- Гейт навешан на POST `/actions`, `/plantings`, `/harvests` (онбординг/чтение/настройки —
  открыты). PATCH/reminders пока не гейтил (риск).
- Android: `DachaApi.syncSubscription`, `AuthRepository.syncSubscription` (best-effort),
  `SubscriptionManager.refresh()` синкает `active = (activeProductId != null)` на сервер.
- Тесты: `access.test.js` — 6 юнит (hasAccess/isSubscribed/trialInfo) + 3 интеграции (402/200/401)
  с реальным requireAccess. buildApp получил мягкий requireAccess (общие тесты не требуют триала).
  Сьют 123/123.
⚠️ **Рантайм-нюанс**: окно подписки скользящее (7 дн). Подписчик, не открывавший приложение
>7 дн, временно получит 402 на запись — снимется при следующем запуске (re-sync). Старые APK
(без syncSubscription) после истечения триала получат 402 даже при оплате, пока не обновятся —
гейт и клиентский синк должны выкатываться вместе (новый APK). Подделка статуса возможна
модифицированным клиентом (серверной валидации чеков RuStore нет) — но планка выше, чем
сброс данных. ✅ compileDebugKotlin. Задеплоено на dacha-api. Пересборка APK.

### Баг-фикс — автоподстановка города перекрывала поле ввода
**Симптом**: при вводе города список автодополнения открывался ПОВЕРХ строки ввода,
перехватывал фокус (нельзя было продолжать печатать) и не сворачивался.
**Причина**: `CityInputField` использовал `DropdownMenu` внутри `Box` — Material3 DropdownMenu
якорится к началу Box и рисуется поверх поля + это focusable-popup (крадёт фокус у TextField),
а `onDismissRequest` был пустой.
**Фикс**: переписан на `ExposedDropdownMenuBox` + `ExposedDropdownMenu` (Material3 1.2.1,
`Modifier.menuAnchor()`). Список открывается ПОД строкой, привязан к её ширине, поле остаётся
редактируемым (клавиатура не закрывается, символы добавляются/удаляются → список обновляется).
Логика сброса подсказок в GardenViewModel/GardenEditViewModel не менялась (selected/<2 симв.
уже чистят). Фикс затрагивает оба экрана (CreateGarden + GardenEdit). ✅ compileDebugKotlin.
Пересборка APK.

### Разгрузка Today — прогноз на 7 дней сворачиваемый (из дизайн-ревью)
Прогноз нужен редко ежедневно → в `WeatherDetailsCard` (TodayScreen) сделан сворачиваемым:
заголовок «Прогноз на 7 дней» стал кликабельной строкой с шевроном (ExpandMore/ExpandLess),
по умолчанию **свёрнут**, состояние в `rememberSaveable`. Сами чипы прогноза рендерятся только
в развёрнутом виде. Дубля температуры нет: Hero = сводка (крупная t° + условие + чипы),
карточка = детали (осадки/почва/предупреждения) + (свёрнутый) прогноз — сегодняшней t° в
карточке нет. ✅ compileDebugKotlin. Пересборка APK.
