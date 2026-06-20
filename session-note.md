# Протокол рабочей сессии разработчика

**Дата последней сессии**: 2026-06-20

## Сессия 2026-06-20 (2) — F12 фото-дневник: спек + план + BACKEND задеплоен

Полный цикл superpowers по фиче **F12 (фото-дневник посадок)**: брейнсторминг → спек
(`docs/superpowers/specs/2026-06-20-photo-diary-design.md`) → план
(`docs/superpowers/plans/2026-06-20-photo-diary-backend.md`) → реализация backend через
subagent-driven (8 задач, TDD) → деплой на прод.

**Архитектура (утв.):** гибрид — фото = отдельная сущность `planting_photos` (nullable `action_id`),
захват из листа действия (наполняет дневник пассивно) + standalone; **личная приватная лента сейчас**,
публичный фид + **модерация запретного контента (блокер соц-Tier'а)** — позже. Лимиты: free 3 /
paid 30 на посадку + потолок ~1000/аккаунт. Хранение `/var/www/dacha-media/` (вне гита), отдача через
**X-Accel-Redirect** (истинная приватность), EXIF/GPS срезаем. AI-разрешение = 1600px webp (Claude
Vision и так даунскейлит до ~1568px). Полностью в спеке.

**Backend (РЕАЛИЗОВАН + ЗАДЕПЛОЕН, тесты 327 vitest):** миграция 044 (`planting_photos`),
`services/imageService.js` (sharp: resize 1600px→webp + thumbnail 400px, срез EXIF), `routes/photos.js`
(POST/GET/DELETE/`GET /file/:id`), джоба-сборщик осиротевших файлов `photoSweepJob`. Зависимости:
`sharp@0.35.2`, **`@fastify/multipart@8`** (v10 требует Fastify 5 — даунгрейд под Fastify 4).

**Деплой backend (прод, VPS на `b1f6313`):** `git reset --hard` + `npm install` (sharp под Linux OK,
vips 8.18.3); миграция 044 + `ALTER TABLE planting_photos OWNER TO dacha_user`; каталог
`/var/www/dacha-media` (root:www-data 750); nginx — добавлены `client_max_body_size 12m` + `internal`-
локация `/media-internal/` (alias на медиа-каталог), бэкап `dacha.bak.photos`, `nginx -t` OK, reload;
`pm2 restart`. **E2E-смоук пройден:** POST→201 (sharp обработал, файлы записаны), GET /file → 200
image/webp (X-Accel-Redirect отдал байты), thumb→200, list→200, DELETE→204 (файлы и строка удалены).
API аддитивный — **бездействует, пока нет клиентов**.

**Осталось по F12:** планы и реализация **веб- и Android-клиентов** (отдельные планы, пишутся после
backend). Точки захвата: лист действия (`ActionLog{Sheet,BottomSheet}`, в мульти-режиме фото off) +
standalone на экране посадки; лента (сетка thumb → полноэкранный просмотр). Оффлайн-кью загрузки —
после F1.

⚠️ Гоча PowerShell→ssh: here-string добавляет CRLF → имя файла в конце строки становится `dacha\r`
(«No such file»); для одиночных команд — прямой `ssh hetzner '...'`, для конфигов — собрать локально
+ scp + `sed -i 's/\r$//'`.

## Сессия 2026-06-20 — Продуктовое исследование, UI-ревью, GTM + реализация Tier 1

> ✅ **ДЕПЛОЙ TIER 1 ВЫПОЛНЕН 2026-06-20** (см. блок «Деплой» ниже). Tier 1 был только в рабочем
> дереве (не закоммичен) → коммит `b555cae` → push в `main` → выкатка на VPS. Остаётся: Android
> (собирает/публикует пользователь) + домаркировать gplay-тестеров `is_test=true` (триаж списка).

### Деплой Tier 1 — выполнено 2026-06-20
- Backend: `git reset --hard origin/main` (VPS на `b555cae`); миграции **041/042/043** применены
  через `sudo -u postgres psql -f` (041: +`is_test`, UPDATE 4 синт. + UPDATE 3 dev, индекс; 042:
  `trial_emails`; 043: +`email_optout`). `trial_emails` → `ALTER OWNER TO dacha_user`. `pm2 restart`,
  health ok. `npm install` НЕ нужен (зависимости не менялись), env НЕ задавал (`UNSUBSCRIBE_SECRET`
  опц. → fallback `JWT_SECRET`, `PUBLIC_API_URL` → дефолт прод-хост).
- Веб пересобран на VPS (`npm ci && build` → `/var/www/dacha-web`), `/app/` → 200.
- Лендинг: `cp landing/{offer,privacy}.html → /var/www/dacha-landing/`, `/offer` `/privacy` → 200.
- Смоук: `/unsubscribe` плохой токен → 400 «Ссылка недействительна»; валидный токен (через
  `buildUrl` с dotenv) → 200 «Вы отписаны» + `email_optout=true` (флаг тест-юзера возвращён в false).
- Воронка после триажа: **17 тест / 2 реальных**. Помечены 6 из списка тестеров + ещё 4 (id 5,7,13,14 —
  знакомые/RuStore-тестеры, по уточнению владельца). Реальная органика = ровно `viserspun@ya.ru` (8) и
  `gladkova@astrum.nov.ru` (19). 10 тестеров из списка ещё не регистрировались.
  ⚠️ При регистрации они попадут в «реальные» → перед маркетингом повторить
  `UPDATE users SET is_test=true WHERE lower(email) IN (...)` по полному списку
  (см. memory `reference_dacha_testers`).
- ⚠️ Гоча PowerShell→ssh: `psql -c "..."` с двойными кавычками ломается (см. сбой `ALTER OWNER`) →
  SQL слать через stdin (`'SQL' | ssh hetzner 'sudo -u postgres psql -d dacha_db'`).

> ⚠️ Историческая пометка: всё НИЖЕ описано как «в коде, не задеплоено» — на момент написания. Теперь
> задеплоено (см. блок «Деплой» выше).

**Аналитика/стратегия (новые доки):**
- `docs/product-research-2026.md` — исследование (рамка + конкурентная разведка + бэклог F/U).
- `docs/ui-review-2026.md` — UI-ревью: веб (§1–4) + Android по скриншотам (§5b/5c). Вывод:
  **приложение полированнее веба**; единственный крупный пробел — нет фото в карточках культур/посадок
  (в справочнике проблем фото есть). Веб надо подтягивать к приложению.
- `docs/gtm-strategy-ru.md` — GTM РФ с упором на автоматизацию (контент-двигатель «лунный календарь»).
- `docs/master-plan-2026.md` — сводный приоритизированный план (Tier 0–4). **План работ на дальше.**
- ⚠️ Воронка: реальных юзеров пока нет (всё тест-аккаунты). Реальная органика — только
  `gladkova@astrum.nov.ru` и `viserspun@ya.ru` (НЕ тестовые).

**RuStore Review (день 6):** `ru.rustore.sdk:review:9.1.0` (rustoreImplementation), `AppReview` по
паттерну `Ads` (rustore-реальный, gplay/samsung — no-op), триггер в MainActivity по
`TokenStorage.isReviewDue()` (`REVIEW_AFTER_DAYS=6`). Компилируется.

**Tier 1 (реализован, тесты 312/312 vitest):**
- **1.1 Аналитика:** миграция `041` (флаг `users.is_test` + пометка тест-аккаунтов), skill
  `/statistic_funnel`; `/statistic`,`/statistic_user` теперь исключают тесты.
- **1.2 Email-цепочка триала:** миграция `042` (`trial_emails`), `trialEmailsJob` (cron 09:00, дни
  1/3/5/6/8, идемпотентно), шаблоны в `emailService` (обезличены — `users.name` почти пуст), ветвление
  по участку (день 1) и активности (день 5), исключение оплативших. + **U7 ценностный paywall**
  (web+Android, `/analytics/summary` += `plantings_count`).
- **Легал + автоотписка:** privacy/offer обновлены (сервисные письма + право отписки); миграция `043`
  (`users.email_optout`), `utils/unsubscribe.js` (HMAC-токен), роут `GET /unsubscribe`, ссылка в футере
  писем, фильтр в джобе.
- **1.3 Контраст hero:** Android (тень температуры + тёмная подложка чипов) + Web (тень текста + чипы
  `bg-black/25`). `primary` не трогали.
- **1.4 logout чистит push-токен:** токен сохраняется локально при регистрации, на выходе
  `deletePushToken` до очистки auth-токена.
- **1.5 Веб-паритет:** поиск культур + состояния loading/empty + тени hero (портировано из приложения).

**Деплой-шаги (СЛЕДУЮЩАЯ сессия):**
1. Backend: `npm run migrate` (применит **041, 042, 043**); env опц. `APP_URL`, `PUBLIC_API_URL`,
   `UNSUBSCRIBE_SECRET`. Прочих gplay-тестеров пометить `UPDATE users SET is_test=true WHERE email='...'`.
2. Пересобрать/выложить лендинг (privacy/offer) и веб (`/app/`).
3. Android: собрать/опубликовать (review день 6, контраст hero, push-токен, U7 paywall) — публикует пользователь.
4. Проверить: `/unsubscribe` по ссылке из письма; письма уходят только реальным/не оплатившим/не отписавшимся.

**Дальше по плану:** Tier 2 — `F1 офлайн «Сегодня»` → `F12 фото-дневник посадок`.

## Сессия 2026-06-19 (2) — Чек НПД: E2E-фикс релея + ротация секрета + UX-правки Android/лендинг

**1. Авто-чек НПД заработал end-to-end (РЕАЛИЗОВАНО + ЗАДЕПЛОЕНО).** Реальный платёж прошёл, но
чек не регистрировался. Диагностика чтением прода (payments + `[nalog-job]` логи). Два бага:
- **Релей терял токен ФНС → `/income: HTTP 401`.** Apache на reg.ru (shared) вырезает заголовок
  `Authorization` до PHP. `/auth/token` (без авторизации) работал → падал только `/income`. Фикс
  (`64669ef`): бэкенд дублирует токен в кастомный `X-Relay-Auth` (`nalogService.buildRequest`),
  релей переотправляет его в ФНС как `Authorization` (`nalog-relay.php`). Тест в `nalogService.test.js`. 300/300.
- **Деплой релея `scp`-ом затирал секрет** плейсхолдером из репо (секрет не в гите) → relay
  `403 bad secret` (мой регресс при первом деплое релея, восстановили). Фикс (`d5a6cfb`): релей
  читает секрет из файла `.relay-secret` рядом со скриптом (env → файл → плейсхолдер); `scp` .php
  его не трогает. Файл создан на reg.ru (`umask 077; printf '%s' '<секрет>' > .relay-secret`).
- ✅ Подтверждено: payment id=7 → `npd_status=registered`, `npd_receipt_uuid=201wjii3uq`, письмо ушло.
  Ре-триггер failed-чека: `UPDATE payments SET npd_status='pending', npd_attempts=0, npd_last_error=NULL`
  + ручной прогон джобы (`node -e` с dotenv + Pool по `DB_*` + `runNalogReceipts(pool)`).
- ⚠️ Гоча: bash `. ./.env` на Hetzner врёт (в `.env` кириллица/пробелы без кавычек → манглит
  значения) — проверять секрет через Node/dotenv + sha256, не через sourcing.

**2. Ротация `NALOG_RELAY_SECRET`** (старый засветился в чате → мёртв). Новый 64-hex синхронен в
Hetzner `.env` и reg.ru `.relay-secret` (sha256-матч `f58978d0…`), `pm2 restart`. Бэкап `.env.bak.rotate.*`.

**3. UX-правки Android** (влито в `main`, `:app:compileRustoreDebugKotlin` OK; APK/AAB публикует пользователь):
- Регистрация: кнопка «Назад» уводит на Login, если экран пришёл из intro (был единственным в
  бэкстеке → `popBackStack` возвращал false, ничего не делал).
- Создание участка: крестик-очистка поля города (popup `ExposedDropdownMenu` в Material3 1.2.x
  перехватывает фокус → удаление срабатывало не всегда); название помечено обязательным (*) + инлайн-валидация.
- Онбординг культур: убран кап `.take(24)` (список обрывался на «М»); длинные названия переносятся
  на 2 строки (свой чип вместо `FilterChip` с фикс. высотой).
- Онбординг → «Посадки»: баннер «Проверьте даты посадки» (даты ставятся = сегодня без выбора),
  флаг в `TokenStorage`, снимается по «Понятно».

**4. Лендинг:** RuStore-кнопки ведут на `https://www.rustore.ru/catalog/app/ru.dachakalend.app`
(`target=_blank`), Google Play остался «Скоро». Влито в `main`, **задеплоено** на VPS
(`scp` → `/var/www/dacha-landing/index.html`, `chown www-data`), ссылка живёт в проде.

## Сессия 2026-06-19 — Авто-чеки НПД («Мой налог») + RU-релей + gplay-сборка

**1. Авто-регистрация чеков НПД через «Мой налог» (РЕАЛИЗОВАНО + ЗАДЕПЛОЕНО, в проде).**
Сервис ЮKassa «Чеки для самозанятых» прекращён 29.12.2025 → доход в ФНС регистрируем сами через
неофициальный API `lknpd.nalog.ru`. Спека `docs/superpowers/specs/2026-06-18-nalog-npd-receipts-design.md`,
план `docs/superpowers/plans/2026-06-18-nalog-npd-receipts.md`.
- **Поток:** webhook `/billing/webhook` помечает платёж `payments.npd_status='pending'` (ФНС синхронно
  НЕ дёргает) → cron `nalogJob` (каждые 5 мин, бюджет ≤2 вызова/прогон под лимит ФНС 2 запроса/мин)
  регистрирует доход (`addIncome`) → сохраняет `npd_receipt_uuid` + шлёт покупателю письмо со ссылкой
  на чек (`emailService.sendReceiptLink`). Возврат (`refund.succeeded`) → `npd_status='cancel_pending'`
  → `cancelIncome(REFUND)`. Ретраи 5 → `npd_status='failed'` + алерт на `ADMIN_EMAIL`.
- **Код:** `backend/src/services/nalogService.js` (тонкий клиент, токен/refresh из `nalog_auth`,
  401-retry, выбор транспорта релей/прокси), `backend/src/jobs/nalogJob.js`, правки `routes/billing.js`
  и `services/emailService.js`, миграция `040_nalog_receipts.sql` (колонки `npd_*` в `payments` +
  таблица `nalog_auth`), bootstrap `scripts/nalog-auth.js`, релей `scripts/nalog-relay.php`. Тесты **300**.
- **RU-транспорт** (ФНС режет не-РФ IP, бэкенд на Hetzner/Германия): PHP-релей на reg.ru shared-хостинге,
  URL `https://next-status.com/nalog-relay.php` (docroot `~/public_html/next-status.com/`, `ssh reg`,
  PHP 7.2.34+curl). Бэкенд → релей (`X-Relay-Secret`+`X-Relay-Path`) → ФНС. Альтернатива — forward-прокси
  на RU-VPS (`NALOG_PROXY_URL`); если заданы оба — приоритет у релея. ⚠️ reg.ru shared НЕ годится для
  Squid/SSH-туннеля (нет root, TCP-форвардинг запрещён); технический хост `*.cp.regruhosting.ru` нельзя
  для HTTPS (cert не покрывает) — нужен реальный домен (`next-status.com` → reg.ru 31.31.198.188, валидный cert).
- **Прод (Hetzner) `.env`:** `NALOG_INN=540861624727`, `NALOG_RELAY_URL`, `NALOG_RELAY_SECRET` (64 hex),
  `NALOG_DEVICE_ID=ba58714129d8dc4adec13`, `YOOKASSA_RECEIPT_MODE=off`. Миграция 040 применена,
  `refresh_token` в `nalog_auth` (bootstrap по SMS прошёл). Реальные эндпоинты SMS-авторизации ФНС:
  `/auth/challenge/sms/start` и `/auth/challenge/sms/verify` (НЕ `/auth/challenge` — был 404).
- ⚠️ **ОТКРЫТО (продолжить в новой сессии):** end-to-end проверка реальным платежом НЕ проведена
  (пользователь не захотел проводить реальную оплату). При тестовой оплате проверить
  `payments.npd_status='registered'`+`npd_receipt_uuid`, логи `[nalog-job]`, письмо с чеком, доход в «Мой налог».
  Релей-транспорт уже подтверждён (ФНС вернула 422 «Пустой refreshToken» на тест-запрос).

**2. Уборка гита.** Все фич-ветки уже были влиты в `main` → удалены (7 локальных + 4 на origin),
осталась только `main` (`origin/main` == локальный). Build-вывод флейворов (`android/app/*/release/`)
добавлен в `.gitignore`, ошибочно затреканный `android/build/reports/problems-report.html` расстрекан;
закоммичены store-ассеты (`docs/store-assets/`).

**3. gplay AAB для тест-трека.** `versionCode 4→5` (versionName 1.0.2). Подписанный
`android/app/build/outputs/bundle/gplayRelease/app-gplay-release.aab` (9.6 МБ, ключ `dacha-release`).
Сборка: `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` → `gradlew.bat -p android bundleGplayRelease`.
Заливка в Play Console (закрытое тестирование) — пользователем. Деплой бэкенда не требовался (только доки).

**4. Уроки (SSH/сборка с Windows).** PowerShell-пайп в `ssh … 'bash -s'` добавляет BOM на 1-ю строку
(жертвуем строкой-пустышкой `true`) и CRLF (ломает `for`/подоболочки `(...)`) → перед пайпом заменять
CRLF→LF. Прямой `ssh '… "двойные кавычки" …'` из PowerShell съедает внутренние кавычки → команды с
кавычками/пайпами слать через `bash -s`. Gradle на Windows: задавать `JAVA_HOME` (JBR Android Studio).
Чтение/запись боевого `.env`/БД по SSH — авто-страж требует явного разрешения пользователя.

## Сессия 2026-06-17 (4) — Подготовка к публикации в Google Play

**1. Отдельные легал-страницы (задеплоены, прод).** Вынес из лендинг-секции `#legal` в самостоятельные
URL (для Play Console и in-app ссылок): `https://dacha.studio1008.com/{privacy,offer,account-deletion}`.
Файлы — `landing/{privacy,offer,account-deletion}.html` (стиль Solar Dacha, self-contained). На VPS:
scp в `/var/www/dacha-landing/` + nginx exact-локации `= /offer`, `= /privacy`, `= /account-deletion`
(бэкапы `dacha.bak.legal`/`dacha.bak.deletion`, `nginx -t` OK, reload). Все отдают 200.
⚠️ Деплой лендинга — **напрямую scp** (не через git-зеркало), nginx-конфиг вне git.

**2. Ссылки на политику/оферту/удаление — поправлены везде.** Web `SettingsScreen.tsx` и Android
`SettingsScreen.kt`: «Пользовательское соглашение/#legal» → «Публичная оферта»/`/offer`,
«Политика»/`/privacy`, + новая строка «Удаление аккаунта и данных»/`/account-deletion`. Лендинг
`index.html`: в блоке политики ссылка на `/account-deletion`, в футере — Оферта · Политика · Удаление.
`sitemap.xml` += `/offer`, `/privacy`, `/account-deletion`. Историю (`session-note`, планы) и
schema-`@id` в JSON-LD не трогал. ⚠️ Web-ссылки задеплоятся при пересборке веба; Android — со сборкой.

**3. ASO-карточка `aso-gplay-samsung.md`** переписана под текущую модель (платная подписка, БЕЗ
рекламы; Samsung снят). Убраны Advertising ID/реклама из Data Safety, добавлена «История покупок».
Название Play (лимит 30): **«Календарь дачника: сад, огород»** (30 симв.; вариант «…: сад и огород» = 31).
Privacy URL → `/privacy`.

**4. Data Safety** — выверен по факту (схема БД, `LocationHelper` читает GPS → precise location;
зависимости — только FCM, без Crashlytics/Analytics). Собираем: Email, User IDs, История покупок,
Approximate + Precise location, Other user-generated content, Device ID — всё «collected, not shared».
Проверил экспорт пользователя из Play, нашёл и исправил over-declarations (лишние Analytics/
Personalization, ephemeral, Messages, неверный способ входа).

**5. Демо-пользователь для скриншотов/тестов** (`demo@dacha.ru` / `demo1234`, прод): участок
Краснодар (garden 12), посадки подобраны так, что на «Сегодня» по одной задаче каждого типа
(пересадка/уход/полив/подкормка/урожай + reminder); лишние care-задачи погашены логами «вчера».
Триал растянут до **30 дней** (`trial_started_at = now()+23d`, т.к. `TRIAL_DAYS=7` — глобальная
константа). frost_alert не воспроизвести (зависит от реальной погоды).

**6. Скиллы статистики** (локальные, в gitignored `.claude/skills/`): `/statistic` (кол-во
пользователей: всего/подтв./платных), `/statistic_user` (таблица: дата рег., email, подтв.,
промокод, платный). SQL выверен на проде; запуск — SSH из PowerShell + SQL в psql через stdin/base64.

**7. Feature graphic 1024×500** для Play — `docs/store-assets/feature-graphic.png` (+ генератор
`gen_feature_graphic.py` на Pillow, стиль Solar Dacha: градиент, подсолнух, грядка, пчёлы, бабочки).

**8. Уроки для будущих SSH-вызовов:** PowerShell `Invoke-RestMethod` ломает UTF-8 (кириллица →
`?????`) — для данных с кириллицей слать через psql/base64, не IRM. SSH-команды с кавычками/пайпами —
кодировать в base64 и `echo b64 | base64 -d | bash`; большие пейлоады (>32k) — через `scp`, не аргумент.

## Сессия 2026-06-17 (3) — Пуши не приходят: диагностика + гигиена + фикс листа

**1. Почему не приходили пуши (несколько дней).** Cron `careRemindersJob` (09:00) исправно
запускался и помечал `care_alert_log` (17.06: полив 101, пересадка 4), НО единственный реальный
токен устройства (`push_tokens` id=172, user 2, provider=fcm) **мёртв**: FCM-dry-run отдал
`messaging/registration-token-not-registered`. Ошибка проглатывалась (`fcmService` только логировал),
а `care_alert_log` помечался **безусловно** → провал доставки выглядел как успех, баг копился.
Две rustore-строки (len 32) — заглушки, не реальные токены. Диагностика: dry-run `validate_only=true`
по токену (без реальной доставки) на VPS.

**2. Гигиена пушей (backend, TDD, задеплоено? см. ниже).**
- `fcmService.sendViaFcm` → возвращает `{delivered, invalidToken}`; коды мёртвого токена
  (`registration-token-not-registered`/`invalid-registration-token`/`invalid-argument`) → `invalidToken=true`.
  Тест-сид `_setMessaging`.
- `pushService`: новый `sendToGarden` — шлёт на все токены участка, **удаляет мёртвые** из `push_tokens`,
  возвращает `delivered` (хоть одна доставка). `sendFrostAlert`/`sendHeatAlert`/`sendCareDigest` переведены
  на него. `deletePushToken(db, token)`. RuStore 404 → тоже `invalidToken`.
- `careRemindersJob.sendDigestAndMark`: помечает `care_alert_log` **только при фактической доставке**
  (иначе повтор завтра). Тесты **273/273** (+7).
- Мёртвый токен #172 удалится автоматически при следующей отправке. Юзеру: открыть приложение на
  устройстве → регистрируется свежий токен.

**3. Google Play пуши.** Для опубликованной Play-сборки нужен **третий SHA-1** (App signing key
certificate из Play Console) в ограничении Firebase API-key (Google Cloud Console) — давний TODO.
Токен #172 был с gplay-debug (debug-ключ уже в ограничении), поэтому регистрировался.

**4. Фикс листа мульти-действия (Android).** Юзер: в новом билде тап по крестику в групповом
действии (2 культуры) **закрывал лист**. Причина — баг Material3 **1.2.x** (Compose BOM 2024.05.00):
`ModalBottomSheet` спонтанно вызывает `onDismissRequest` при **уменьшении высоты контента**. Фикс
(`ActionLogBottomSheet.kt`): крестик больше не удаляет строку из разметки, а **исключает культуру**
(зачёркивание + иконка «вернуть» ↺, обратимо); высота листа постоянна → лист не закрывается. Пишется
только активным (незачёркнутым), минимум одна активная. `:app:compileGplayDebugKotlin` SUCCESSFUL.
Веб не затронут (там обычный HTML-лист, бага нет). ⚠️ Установить debug-билд поверх тест-сборки юзера
не вышло (разные подписи) — проверяет пользователь на своём билде.

## Сессия 2026-06-17 (2) — Групповые care-задачи: мульти-посадочное действие

Реализована открытая задача прошлой сессии: сгруппированная care-задача на «Сегодня»
(«Прополка: Капуста пекинская, Редис») стала кликабельной и открывает лист действия в
мульти-посадочном режиме. Поведение по согласованному спеку: заголовок — список культур с
крестиком удаления (минимум одна остаётся), одно действие пишется во все оставшиеся посадки.
Все 3 платформы. **НЕ задеплоено.**

**Backend** (`utils/todayLogic.js`, TDD): групповой `care_task_due` из `buildTasks` теперь несёт
`planting_ids: number[]` и `crop_names_with_ids: {id,name}[]`; `formatTasks` пробрасывает оба поля
(одиночные задачи → null). Новых эндпоинтов нет — клиент циклит существующий `POST /actions` по
каждой посадке (сохраняется per-planting IDOR-проверка). Тесты: **266/266** (+2 в
`__tests__/unit/todayLogic.test.js`). ⚠️ Раннер — **vitest** (`npm test`), не jest (jest-прогон
ложно валит `careRemindersJob.test.js` на `vi is not defined`).

**Web** (`api/types.ts`, `components/ActionLogSheet.tsx`, `screens/TodayScreen.tsx`): `TodayTask` +=
`crops`/`planting_ids`/`crop_names_with_ids` + новый `CropRef`. `ActionLogSheet` принимает
`plantings: CropRef[]` + `title` → групповой режим (удаляемый список, цикл записи по оставшимся
последовательно). `TaskCard` делает групповую карточку кликабельной; «Подробнее →» только для
одиночных. Проверено в превью (логин тест-аккаунтом, fetch-шим подставил новые поля т.к. прод
ещё на старом ответе): карточка кликабельна → лист «Прополка» со списком Капуста/Редис, удаление
до 1 с дизейблом крестика, предвыбор «Прополка». `tsc --noEmit` чисто.

**Android** (`data/model/Models.kt`, `ui/actions/ActionLog{BottomSheet,ViewModel}.kt`,
`ui/today/TodayScreen.kt`): `TodayTask` += поля + `data class CropRef`. `ActionLogBottomSheet`
рефакторен — общий `ActionLogSheetImpl(title, initialTargets, grouped)`; новый публичный
`MultiActionLogBottomSheet`. VM: `logActionMulti`/`logTransplantingMulti` (цикл по ids,
первая ошибка прерывает). `TodayScreen`: групповая задача (`plantingId==null` +
`cropNamesWithIds`) кликабельна → `multiTask` → мульти-лист. `:app:compileGplayDebugKotlin`
**BUILD SUCCESSFUL** (только пред-существующие warning'и).

**✅ Закоммичено и задеплоено** (HEAD `232d024`, влито в `main`, запушено): backend на VPS
(`reset --hard origin/main` + `pm2 restart`, health ok, прод `/today?garden_id=4` отдаёт
`planting_ids`+`crop_names_with_ids`), веб пересобран (`npm ci && build` → `/var/www/dacha-web`,
`/app/` → 200). Миграций/`package.json` не было. Android AAB/APK публикует пользователь.

## Сессия 2026-06-17 — Кусты/Деревья + сборка билдов + секция «Скоро»

**1. Категории «Кусты» и «Деревья»** (миграции 037–039, задеплоены в прод в прошлой сессии,
зафиксировано здесь). Переклассифицированы: Малина/Смородина чёрная/Крыжовник → `shrub`.
Добавлены кусты: Смородина красная/белая, Ежевика, Жимолость; деревья: Яблоня, Груша, Вишня,
Черешня, Слива (все `is_perennial=true`). Карточки заполнены: watering, fertilizing, care_tasks,
болезни/вредители с фото Wikimedia Commons. Метки `shrub`/`tree` добавлены в Android
`CropsViewModel.CROP_CATEGORIES` и `web/src/api/labels.ts`.

**2. Подготовка билдов для магазинов** — `docs/gplay-publishing-guide.md` дополнен
пошаговой инструкцией сборки через Android Studio UI (APK для RuStore / AAB для Google Play),
шаг с Firebase SHA-1 после первой загрузки AAB в Play Console. `versionCode` поднят `2 → 3`,
`versionName` `"1.0.0" → "1.0.1"`.

**3. Секция «Скоро» на экране «Сегодня»** (коммиты `de798ee`, `1510a08`, задеплоено):
- **Проблема**: care_tasks с опережением 1–3 дня (`days_until > 0`) смешивались с задачами
  сегодняшнего дня. Корень — строка `offset <= daysSincePlanting + 3` в `buildTasks`.
- **Решение**: две секции — «Задачи на сегодня» и «Скоро» (только просмотр, без тапа).
- **Backend** (`todayLogic.js`): `days_until` добавлен в ответ `formatTasks`.
- **Android** (`Models.kt`, `TodayScreen.kt`): поле `daysUntil`, разбивка tasks на
  `currentTasks`/`upcomingTasks`, новая секция с `SectionTitle(CalendarMonth, "Скоро")`.
  `coachScrollIdx` пересчитан. Карточки «Скоро» — `onClick = null`.
- **Web** (`types.ts`, `TodayScreen.tsx`): поле `days_until`, аналогичная разбивка,
  секция `<h2>Скоро</h2>`. `TaskCard` принимает опциональный `onLog`.
- **Фикс**: иконка прополки `Trash2 → Axe` (выглядела как «удалить»).

**4. Открытая задача следующей сессии — групповые care-задачи** (не реализовано):
Сгруппированные задачи («Прополка: Капуста пекинская, Редис») — некликабельны, нельзя
выполнить и закрыть. Согласовано поведение:
- Клик → открывает «Действие» (как у одиночных)
- Заголовок листа: список растений построчно, у каждого крестик удаления (мин. 1 остаётся);
  удалённые выпадают в индивидуальные задачи по общим правилам
- Одно действие записывается во все оставшиеся посадки одновременно
- **Нужны изменения**: backend (добавить `planting_ids: number[]` в grouped task response),
  Android (новый/расширенный BottomSheet), Web (расширить `ActionLogSheet`).
- Применимо и к веб, и к Android.

## Сессия 2026-06-16 — фото справочника (волна 2) + П4 «Аккаунт и безопасность»

**1. Справочник проблем — фото 43→52/68** (commit `0b0ce90`, миграция 035, в проде). +9 кадров
с Wikimedia Commons по латинским именам (церкоспороз, парша, рамуляриоз, дидимелла, слизистый
бактериоз, землянич./малинно-землянич. долгоносик, гороховая плодожорка, морковная листоблошка),
каждый просмотрен глазами; вотермарки Bugwood/UGA и лабораторные микрофото отбракованы. Остаток 16 —
без годного свободного кадра. Пайплайн `C:\Projects\Dacha\guide-photos-tmp\`.

**2. П4-срез «Аккаунт и безопасность» (A+B+E)** — полный цикл по superpowers (брейнсторминг → спек →
план → TDD-реализация → ff-merge → деплой). Спек/план: `docs/superpowers/{specs,plans}/
2026-06-15-account-security-settings*`. Итоговый HEAD `dffda62`.
- Backend (`routes/auth.js`, миграция 036): `PATCH /auth/password`; смена email **verify-first**
  (`POST /auth/change-email` + `/auth/confirm-email-change` через `users.pending_email`, код на новый
  адрес, `email_codes` purpose=`change_email`); `DELETE /auth/me` (**hard delete каскадом** + строки
  `payments` анонимизируются `user_id=NULL` для чеков НПД; FK сменён CASCADE→SET NULL). `/auth/me` +=
  `pending_email`. Тесты 264/264 (+14).
- Web: модалки `Change{Password,Email}Modal`/`DeleteAccountModal` + секция «О приложении» в Настройках.
  Android: секции «АККАУНТ»/«О ПРИЛОЖЕНИИ» + 3 диалога. Подтверждение опасных действий — текущим паролем.
- Деплой: миграцию прод-БД (ALTER `payments`) и прод-smoke с паролем в команде авто-классификатор
  требует подтверждать явно → роуты проверял без токена (401 vs 404). Android собран
  (`:app:compileGplayDebugKotlin`), AAB/APK публикует пользователь.
- **Открыто (отдельные циклы)**: смена города (C, `PUT /gardens/:id` готов), управление участками +
  переключатель активного сада (D), уведомления на web.

**3. Лендинг — монетизация, контакты, фикс шапки** (`landing/index.html`):
- **Монетизация (commit `6ac814f`, ЗАДЕПЛОЕНО в прод):** Google Play теперь **платная подписка как
  RuStore** (без рекламы); **Samsung убран полностью** (решено не публиковаться). Рекламной модели
  больше нет нигде → вычищен весь нарратив про рекламу/Yandex Ads из FAQ, оферты, политики
  конфиденциальности, JSON-LD (offers, FAQ). Бейдж скидки 43%→45%. В навбаре при наличии
  `localStorage.dacha_token` показывается email (через `/auth/me`, same-origin) вместо «Войти».
- **Контактная почта (commit `b8641ef`, НЕ задеплоено):** `e-krukov@ya.ru` → **`dacha@studio1008.com`**
  везде в пользовательских местах — лендинг (JSON-LD/оферта/контакты), `landing/README.md`,
  web `SettingsScreen.tsx` («О приложении»), Android `SettingsScreen.kt`. ТЕСТ-ЛОГИН `e-krukov@ya.ru`
  в доках/`gplay-publishing-guide.md` НЕ трогали (это учётка, не контакт). Отправитель транзакционных
  писем `noreply@studio1008.com` (Brevo) не менялся. ⚠️ Ящик `dacha@studio1008.com` должен быть создан.
- **Фикс шапки (commit `9ffa82d`, НЕ задеплоено):** на десктопе при залогиненном чипе шапка
  расползалась на 2 строки. Чинено: `white-space:nowrap` бренду и пунктам, `header .wrap` → 1160px,
  gap пунктов 26→18; на узких (≤1060px) чип сворачивается в аватар (без email), пункты скрываются
  ≤920px. Проверено в превью (порт превью): overflow 0 на 1280/922px, одна строка.

✅ **ЗАДЕПЛОЕНО 2026-06-16:** коммиты `b8641ef`+`9ffa82d` выложены (VPS `reset --hard origin/main` →
`52dfb5d`, `cp landing/index.html` + пересборка веба `/var/www/dacha-web`). Проверено: `/` и `/app/`
→ 200, на лендинге новый email `dacha@studio1008.com`, старый отсутствует. Ящик `dacha@studio1008.com`
создан 2026-06-16 — задача закрыта. Заодно в этой сессии: реструктуризация
`session-note.md`/`summary.md` (старые сессии → `session-note-archive.md`), SDK 36 в доках.

**Отменено:** заводилась фича «категории Кусты/Деревья» — пользователь отменил (только смотрели данные:
категории в БД — `berry/herb/vegetable/flower`; малина/смородина/крыжовник уже есть как `berry`). Кода нет.

## Фикс 2026-06-13 — пуш по чужому участку при смене аккаунта на устройстве

**Симптом**: на `e-krukov@yandex.ru` пришёл пуш «💧 Полейте: Томат», хотя на этой учётке Томат не
посажен.

**Причина**: `push_tokens` имеет `UNIQUE(user_id, token)`, поэтому один физический FCM-токен может
быть зарегистрирован сразу за несколькими пользователями. На тестовом устройстве (Samsung A55)
сначала был залогинен `e-krukov@ya.ru` (`user_id=2`, есть просроченный полив Томата на участке `id=3`),
потом на том же устройстве залогинились как `e-krukov@yandex.ru` (`user_id=6`) — старая привязка
токена к `user_id=2` не удалилась. `careRemindersJob` нашёл просрочку у `user_id=2`,
`getTokensForGarden` вернул тот же физический токен (привязанный к `user_id=2`) → пуш ушёл на
устройство, где сейчас открыт другой аккаунт.

**Фикс** (`28e029e`, влит в `main`, задеплоен): `POST /push-tokens` перед upsert удаляет регистрацию
этого токена у ВСЕХ остальных `user_id` — токен принадлежит одному физическому устройству, поэтому
закрепляется только за текущим залогиненным аккаунтом. Тест `push-tokens.test.js` (5 тестов, +1
маршрут зарегистрирован в `helpers/buildApp.js`). На проде вручную удалена зависшая строка
`push_tokens.id=155` (`user_id=2`, тот же токен).

**Фикс 2** (`4f1e7aa`, влит в `main`, push-only — production-код не менялся): тест
`careRemindersJob.test.js` «подкормка: есть расписание и >14 дней без подкормки» падал (pre-existing,
не связано с фиксом выше): фикстура `fertilizing_schedule: [{ day: 14 }]` не содержит поля `stage`,
которое ищет `schedule.find(f => f.stage === fertStage)` в `careRemindersJob.js`/`todayLogic.js` —
`fertEntry` всегда был `undefined`. Реальные данные `crops.fertilizing_schedule` (миграция 006) всегда
содержат `stage` (например `{"stage":"growing", ...}`) — производственный код корректен, фикстуру
поправили на `{ stage: 'growing' }`. Теперь **218/218**. 213/213 в `summary.md` устарело.

**Не исправлено (вторично)**: на клиенте `SettingsViewModel.logout()` не вызывает
`DachaApi.deletePushToken()` (метод объявлен, но мёртвый код) — серверный фикс выше закрывает баг
независимо от клиента, но для гигиены стоило бы чистить токен при выходе.

---

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

> 📦 Сессии до 2026-06-10 (включительно) вынесены в [`session-note-archive.md`](session-note-archive.md).
