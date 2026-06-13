# Архитектурный статус и прогресс: "Календарь дачника"

## Текущий статус

- **MVP**: ✅ 100% завершён (5 спринтов + пост-MVP доработки)
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL | Android (Kotlin + Compose + Hilt) | **Веб (React+Vite+TS+Tailwind)**
- **Бэкенд**: `https://dacha.studio1008.com/` · порт 3002 · pm2: `dacha-api`
- **Android**: package `ru.dachakalend.app` · minSdk 26 · targetSdk 34
- **Веб-версия**: ✅ задеплоена `https://dacha.studio1008.com/app/` (папка `web/`, статика `/var/www/dacha-web`,
  nginx `location /app/`). Та же БД/API. Монетизация — платная (как RuStore). План — `docs/web-migration-plan.md`,
  деплой — `docs/DEPLOY.md`.
- **ТЗ**: `docs/ТЗ.pdf`

---

## Следующая сессия (приоритет ↓)

### ⏳ TO-DO следующей сессии (приоритет ↓) — обновлено 2026-06-12

**Состояние git:** `main` = `bedd62b` (== origin). Одна ветка `main` (стейл-ветки удалены).
За сессию 2026-06-12 закрыто: **редизайн лендинга** (современный UI/UX) + **SEO/GEO** (JSON-LD,
FAQ, canonical, robots/sitemap, OG-картинка; on-page ~55→~90) + **блок «Как начать»** (`#download`,
фикс CTA-воронки, кнопки магазинов «Скоро») — **задеплоено в прод** + nginx раздаёт статику.
За сессию 2026-06-11 закрыто: FCM в проде (проверено на A55), фикс 500 на логине (миграция 025),
дыра с возвратами ЮKassa, реклама (интерстишл 6→10 + диагностика баннера), ограничение API-key,
чистка git, ASO-карточки GP/Samsung + доработка оферты/политики/блока подписки на лендинге.
Детали — `session-note.md` (блоки 2026-06-12, 2026-06-11).

1. **Google Play — при публикации** (FCM уже работает на gplay-debug):
   - [ ] После создания приложения + первой загрузки AAB добавить **третий SHA-1** в ограничение API-key:
     Play Console → App integrity → **App signing key certificate** (Google переподписывает APK → иначе
     FCM на Play-сборке не зарегистрируется). Debug+release SHA-1 уже добавлены.
2. **Безопасность/гигиена:**
   - [ ] Сменить пароль тест-аккаунта `e-krukov@ya.ru` (светился в чате) — через «Забыли пароль?».
3. **Реклама — дождаться налива:**
   - [ ] Боевой баннерный блок РСЯ `R-M-19420797-1` пока `code=4` no-fill (не баг — код проверен демо-ID).
     Налив баннера ожидается после публикации приложения; интерстишл уже наливается.
4. **E3 (давний долг):** Android unit-тесты не запускаются (баг тулчейна AGP 9). Проверка — `compile*Kotlin`.
5. **«Could» из ТЗ:** сравнение урожая по сезонам (§5.8), профиль участка (§5.2), поля площадь/почва (§5.1).
6. **Лендинг/публикация:**
   - [x] ✅ Задеплоен обновлённый `landing/index.html` на VPS (2026-06-12): редизайн UI/UX + SEO/GEO
     (JSON-LD/FAQ/canonical/robots/sitemap/OG) + блок «Как начать» (`#download`). nginx раздаёт
     `/og.png`/`/robots.txt`/`/sitemap.xml` (3 exact-локации). Оферта/политика/Samsung уже были в файле.
   - [ ] Собрать release AAB для флейвора `gplay` (затем `samsung`), используя карточки из
     `docs/aso-gplay-samsung.md`.
   - [ ] После публикации — заменить кнопки магазинов «Скоро» (`#download` `.store-btn[aria-disabled]`)
     и store-ссылки футера на реальные URL (сейчас ведут на `#download`).
   - [ ] Открытый вопрос: явный consent-диалог перед `MobileAds.initialize` (сейчас
     `MobileAds.setUserConsent(true)` хардкод) — отдельная Android-задача, см.
     `docs/aso-gplay-samsung.md` → «Открытый вопрос — согласие на рекламу».

**Бэкенд-тесты:** 218/218. **Android:** все флейворы `compile`/`assemble*Debug` BUILD SUCCESSFUL.

**Закрыто 2026-06-12:** ✅ Редизайн лендинга (современный UI/UX) · ✅ SEO/GEO (title/description/canonical,
JSON-LD SoftwareApplication+Person+FAQPage, видимый FAQ, `<main>`, robots.txt+sitemap.xml, OG-картинка
1200×630; on-page ~55→~90) · ✅ Блок «Как начать» (`#download`, фикс CTA, кнопки магазинов «Скоро») ·
✅ nginx раздаёт статику лендинга · ✅ Задеплоено в прод + влито в `main` (`bedd62b`).

**Закрыто 2026-06-11:** ✅ Пуши FCM (прод + проверка на A55) · ✅ Миграция 025 (фикс 500 логина) ·
✅ Дыра с возвратами ЮKassa (`refund.succeeded` отзывает доступ) · ✅ Реклама (интерстишл 6→10, лог
баннера) · ✅ Ограничение API-key (debug+release SHA-1) · ✅ Чистка git (одна `main`) ·
✅ ASO-карточки GP/Samsung (`docs/aso-gplay-samsung.md`) · ✅ Оферта/политика/блок подписки на
лендинге доработаны под GP/Samsung (локально, не задеплоено).

### 🔴 КРИТИЧНО — E4: переход RuStore Billing → ЮKassa (рекуррент)

**Причина**: RuStore больше НЕ подключает монетизацию самозанятым. Внутримагазинный биллинг
недоступен → переходим на прямые платежи картой через **ЮKassa (YooKassa)**.

**Решения пользователя (2026-06-05)**: провайдер **ЮKassa**; модель **автопродление (рекуррент)**;
дистрибуция **RuStore + Google Play + Samsung Store**; платёжный UI — **Chrome Custom Tab +
`confirmation_url`** (карта сохраняется на сервере, без тяжёлого SDK).

**⚠️ Магазины — оплата невозможна для РФ-аудитории** (анализ 2026-06-05):
- **Google Play**: in-app биллинг для РФ-аккаунта отключён с 26.12.2024; внешняя оплата разрешена
  только в США/ЕЭЗ, не в РФ. Даже зарубежное юрлицо НЕ спасает — РФ-пользователь не сможет
  заплатить картой в Google-биллинге. Платный путь в GP для РФ-аудитории закрыт с обеих сторон.
- **Samsung Galaxy Store**: прямые платежи из РФ недоступны; канал второстепенный.
- **RuStore**: подключение монетизации самозанятым остановлено (12.12.2025, отключение 01.02.2026) —
  это и есть блокер. НО RuStore официально разрешает альтернативные платежи вне своих SDK и
  **не берёт комиссию** → интеграция ЮKassa в RuStore-сборке легитимна. **Основной канал дохода.**

**Решение по монетизации — РАЗНОЕ по сторам** (см. эпик E5 ниже):
- `rustore` — платный гейт: триал → подписка ЮKassa (E4). Рекламы нет. Жёсткий 402 остаётся.
- `gplay`/`samsung` — оплаты нет → бесплатно с рекламой **РСЯ (Yandex Mobile Ads SDK)**, жёсткий
  402-гейт снимается (AdMob/Google не вариант — новые РФ-аккаунты не регистрируются).

**Ключевая идея**: серверный гейт уже построен на «оплачено до даты» (`subscription_until`,
`hasAccess`, 402). Меняем ТОЛЬКО источник платного флага: вместо синка RuStore-клиента
(`POST /auth/subscription`) — **вебхук ЮKassa**. Триал, промокоды, гейт 402 — НЕ трогаем.

**Схема рекуррента ЮKassa** (подтверждено по докам): (1) первый платёж `save_payment_method:true`
→ в ответе/вебхуке `payment_method.id`; (2) автосписания — серверный `POST /v3/payments` с
`payment_method_id`, `capture:true`, без `confirmation`; (3) вебхуки `payment.succeeded`/`canceled`;
(4) чек 54-ФЗ — объект `receipt` (email + позиции). Все запросы — Basic-auth `shopId:secretKey` +
обязательный `Idempotence-Key`.

**Бэкенд ✅ ГОТОВ (2026-06-05, тесты 196/196, НЕ задеплоен)**:
- [x] Миграция `024_yookassa_billing.sql`: `users.payment_method_id`, `users.auto_renew`, `users.plan`;
  таблица `payments(yk_payment_id UNIQUE, status, amount, plan, is_recurring)`. ⚠️ после миграции
  `ALTER TABLE payments OWNER TO dacha_user;`
- [x] `services/yookassaService.js`: `createPayment` (redirect + `save_payment_method`),
  `chargeRecurring` (по `payment_method_id`), `getPayment` (верификация вебхука), `buildReceipt`
  (чек 54-ФЗ, самозанятый `vat_code=1`). Без `YOOKASSA_SHOP_ID` — биллинг off.
- [x] `routes/billing.js`: `create-payment` → `confirmation_url` (503 если off); `webhook` (публичный,
  перезапрос платежа из API + идемпотентность по `yk_payment_id`, `succeeded` → `extendSubscription`
  + сохранить карту + `auto_renew=true`); `cancel-autorenew`. `/auth/me` += `auto_renew`/`plan`/
  `subscription_until`/`has_saved_card`.
- [x] Cron `jobs/renewalJob.js` (10:00): списывает рekуррент для истекающих ≤1 дня; защита от двойного
  списания (нет рекуррент-платежа за 2 дня); продление — по вебхуку (единый источник истины).
- [x] `access.js extendSubscription`; `.env.example` += блок ЮKassa; тесты `billing.test.js` (12) +
  `renewalJob.test.js` (5) + `yookassaService.test.js` (6). Всего **202/202**.
- [x] **Чеки/налоги (самозанятый)**: `buildReceipt` шлёт `customer.email` + позицию, `vat_code=1`
  (без НДС). Чек переключается env `YOOKASSA_RECEIPT_MODE` (`on`/`off`). Самозанятый освобождён от
  ККТ → чек НПД (422-ФЗ) формирует **интеграция ЮKassa ↔ «Мой налог»** (включить в кабинете
  «Чеки для самозанятых» → ЮKassa авто-регистрирует доход в ФНС + шлёт чек). Налог: «Мой налог»
  считает 4% (с физлиц) + автоплатёж. ⚠️ финальный формат receipt подтвердить в кабинете после
  одобрения (возможно `off`). Оферта лендинга: «кассовый чек 54-ФЗ» → «чек НПД 422-ФЗ».
- [x] **ЗАДЕПЛОЕНО в прод (2026-06-06)**: `main` влит (HEAD `d5f8234`), на VPS `fetch+reset`,
  миграция 024 + `ALTER TABLE payments OWNER TO dacha_user`, `YOOKASSA_*` в `backend/.env` (Shop ID
  1376599, ключ перевыпущен), `pm2 restart`. health ok, `[renewal-job] Запущен (10:00)` в логах.
- [x] **Вебхук настроен + сквозной боевой платёж проверен (2026-06-09)**: оплата 299 ₽ по
  `confirmation_url` → вебхук `payment.succeeded` → `subscription_until` +30 дн, `plan=monthly`,
  `auto_renew=f`, `payments.status=succeeded`. Цикл оплата→вебхук→доступ работает в проде.
- [x] **Возврат средств отзывает доступ (2026-06-11, прод `cebe7ec`)**: вебхук обрабатывал только
  `payment.succeeded`/`canceled` → после возврата доступ оставался (оплатил→вернул→бесплатно). Добавлена
  ветка `refund.succeeded` (`routes/billing.js`): верификация через `yk.getRefund`, поиск платежа по
  `payment_id`, `access.revokeSubscription` (−дни плана), `payments.status=refunded`, `auto_renew=false`,
  идемпотентно. Событие `refund.succeeded` подписано в кабинете ЮKassa. Без миграции. Тесты +3 → 213.
- ⚠️ **РЕКУРРЕНТ ЗАПРЕЩЁН для магазина самозанятого** (смоук-тест create-payment → ЮKassa: «This store
  can't make recurring payments»). Переключились на **разовую оплату + продление вручную**:
  `save_payment_method` спрятан за env `YOOKASSA_RECURRING` (default `off`); вебхук ставит `auto_renew`
  только если карта реально сохранена; renewalJob в этом режиме no-op. Формулировки в приложении
  (Настройки/Paywall) и оферте лендинга обновлены под «продление повторной оплатой». Если ЮMoney
  включит автоплатежи (или оформишь ИП) → `YOOKASSA_RECURRING=on` + `pm2 restart`, без правок кода.
  ⏳ **Требуется передеплой бэкенда** (этот фикс) + редеплой лендинга.
- [x] **Лендинг для модерации ЮKassa** (`landing/index.html` + `return.html` + README): оффер, тарифы,
  оферта, политика конфиденциальности, контакты. Реквизиты заполнены (Крюков Е.В., ИНН 540861624727,
  `e-krukov@ya.ru`). Для подключения магазина в поле «сайт» указать `https://dacha.studio1008.com/`.
  - [x] **Выложен на VPS** (2026-06-06): `/var/www/dacha-landing/`, nginx `location = /` + `= /billing/return`
    перед proxy_pass в `/etc/nginx/sites-available/dacha` (бэкап `.bak`). Проверено: `/`→200 html,
    `/health`→ok, `/billing/return`→200. API не задет.
- [ ] `POST /auth/subscription` (RuStore-синк) — депрекейтить после переключения Android (пока оставлен).

**Android ✅ ГОТОВ (2026-06-05, `compileDebugKotlin` BUILD SUCCESSFUL)**:
- [x] `SubscriptionManager` переписан без RuStore Billing: `refresh()` читает `/auth/me` (источник —
  вебхук ЮKassa); `startPayment(plan)` → `BillingRepository.createPayment` → `confirmation_url`;
  `cancelAutoRenew()`. `SubscriptionStatus` += `subscriptionUntil`/`autoRenew`/`plan`.
- [x] `BillingRepository` (new), `DachaApi` += `createPayment`/`cancelAutoRenew`, `UserProfile` += биллинг-
  поля + `CreatePaymentResponse`.
- [x] `PaywallViewModel`/`PaywallScreen`: оплата открывает `confirmation_url` в Chrome Custom Tab
  (`androidx.browser`), по `ON_RESUME` — поллинг `/auth/me` (8×1.5с). Убрана «Восстановить покупки».
- [x] Настройки: дата окончания подписки + тоггл «Автопродление» (выключение → `cancel-autorenew`;
  включить — новой оплатой).
- [x] `App.kt` — убран `RuStoreBillingClientFactory.init` (Push не тронут); `build.gradle.kts`/
  `libs.versions.toml` — RuStore Billing убран, добавлен `androidx.browser`; убран `RUSTORE_CONSOLE_APP_ID`.
- [ ] **Проверка на устройстве** после деплоя бэкенда: оплата картой → возврат → доступ; отключение
  автопродления; промокоды/триал по-прежнему работают.

### 🟠 E5: реклама РСЯ для GP/Samsung (бесплатная модель без оплаты)

**Причина**: для GP/Samsung оплата из РФ невозможна (см. блок про магазины). Монетизация —
**Yandex Mobile Ads SDK (РСЯ)**, официально работает с самозанятыми (AdMob/Google — нет, новые
РФ-аккаунты закрыты). Делаем после E4.

**SDK** (изучено по докам, версия **8.0.0**, нативный Compose): зависимость
`com.yandex.android:mobileads:8.0.0` (+ Compose-артефакт); `MobileAds.initialize(ctx){}` в `App`;
баннер — `rememberBannerAdState(BannerSize.Inline(...))` + `Banner(state)`; интерстишл —
`rememberInterstitialAdLoader()` → `loadAd` (Success/Failure) → `ad.show(activity)`. В v8 `adUnitId`
идёт в `AdRequest.Builder(id)`. Демо-ID `demo-banner-yandex`/`demo-interstitial-yandex`; нужно согласие.

**SDK по факту**: использован **`com.yandex.android:mobileads:7.12.0`** (v8 Compose-API оказался
неустойчив — взял стабильный v7, View-баннер через `AndroidView`+`BannerAdView`).

**Прогресс (2026-06-09):**
- [x] **Бэкенд: store-гейт** — миграция `025_user_store.sql` (`users.store`), `access.isAdSupportedStore`
  + `hasAccess` (`gplay`/`samsung`→доступ без 402; `rustore`/NULL→платный гейт), `requireAccess` читает
  `store`, register/login принимают `store`. Тесты **207/207**. ⏳ деплой (миграция 025 + код).
- [x] **Флейворы** `rustore`/`gplay`/`samsung` + `BuildConfig` (`STORE`/`PAYMENTS_ENABLED`/`ADS_ENABLED`/
  `BANNER_AD_UNIT`/`INTERSTITIAL_AD_UNIT`). Изоляция рекламы — **штатные флейвор-папки** `src/rustore`
  (no-op `Ads`) и `src/gplay`+`src/samsung` (реальный `Ads` на Yandex; SDK только в этих флейворах).
  Кастомный общий `src/withAds` не сработал на AGP 9 → код `Ads.kt` продублирован в gplay/samsung.
- [x] **Баннер РСЯ** глобально над навбаром (`MainActivity`, только основные экраны; no-op в rustore).
  `Ads.init` в `App`. Клиент шлёт `BuildConfig.STORE` при login/register.
- [x] **Гейт UI по флейвору**: Paywall не открывается при `!PAYMENTS_ENABLED` (`MainActivity`); секция
  «Подписка» в Настройках скрыта в ad-сборках. Все 3 флейвора `compile*DebugKotlin` BUILD SUCCESSFUL.
- [x] **Интерстишл** с частотным кэпом — `Ads.onContentEvent(activity)` (gplay/samsung) показывает
  интерстишл раз в 6 переключений вкладок (`InterstitialAdLoader`+`AdRequestConfiguration`); триггер в
  `MainActivity` nav onClick (no-op в rustore). Все 3 флейвора BUILD SUCCESSFUL.
- [x] **Согласие на рекламу** — `MobileAds.setUserConsent(true)` в `Ads.init` (политика на лендинге).
- [x] **Боевые ID объявлений РСЯ** вписаны в `BuildConfig` (gplay+samsung): баннер `R-M-19420797-1`,
  интерстишл `R-M-19420797-2` (демо-аналоги в комментарии build.gradle для теста на устройстве).
- [ ] Деплой бэкенда (миграция 025 + код store) + пересборка/проверка ad-APK на устройстве.

**Матрица**: `rustore` — ЮKassa разовая оплата, без рекламы, гейт 402 · `gplay`/`samsung` — бесплатно,
баннер РСЯ, без гейта.

### 🔴 Критично (прочее) — всё закрыто ✅

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

- [x] Тесты бэкенда: **147 passed** ✅ (access, careRemindersJob, care_task grouping, trial, getOverdueCareTask, careTaskActionType)
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

## Сделано за сессию 2026-06-04 (пятая: чистка UI + архивные посадки)

- **Календарь**: работы завершённых (`stage='done'`) посадок больше не утекают — задачи из `/today`
  фильтруются по `donePlantingIds` в `CalendarViewModel.buildEvents` (раньше Томат-архив давал работы).
- **«Справочник культур»**: добавлена стрелка «Назад» (`CropsScreen.onBack` → `popBackStack`).
- **Архивные посадки** убраны из источника UI «Сегодня» (`TodayViewModel` фильтрует `stage != "done"`).
- **Блок «Быстрые действия» удалён целиком**: полив — единственное частое действие, а подкормка/обработка
  требуют препарата, редки и уже приходят как задачи дня с предзаполненным препаратом. Запись действия
  теперь только через задачи дня и карточки посадок (`ActionLogBottomSheet` сохранён). Бэкенд не менялся.
- **Поле «Имя» убрано из регистрации** (нигде не использовалось): `RegisterScreen`/`AuthViewModel`/
  `AuthRepository.register` — теперь `(email, password)`; `RegisterRequest` без `name`; `UserProfile.name`
  стал nullable. Бэкенд: `name` в `/auth/register` опционально (`required: [email,password]`,
  `INSERT ... name ?? null`). Колонка `users.name` уже nullable — миграция не нужна. **Требует деплоя бэкенда.**
  Тесты: backend +1 (регистрация без имени), Android — поправлены сигнатуры `register`.

### ⚠️ Замечание по безопасности (для RuStore-декларации и не только)
- **Почта не верифицируется**: бэкенд НЕ отправляет писем (нет SMTP/nodemailer). Нет подтверждения
  email при регистрации, нет восстановления пароля, можно зарегистрироваться на чужой адрес.
- **POST_NOTIFICATIONS не запрашивается в рантайме** (объявлено в манифесте, но на Android 13+
  уведомления молча не показываются без runtime-запроса) — см. session-note.

| # | Задача (отложено) | Почему |
|---|---|---|
| ~~E1~~ | ~~**Верификация email + сброс пароля**~~ ✅ 2026-06-05 (требует деплоя: миграция 023 + SMTP env + npm i) | захват аккаунта на чужой email, нет восстановления пароля |
| ~~E2~~ | ~~**Runtime-запрос POST_NOTIFICATIONS** (API ≥ 33)~~ ✅ 2026-06-05 | иначе пуши/напоминания не доходят на Android 13+ |
| E3 | **Android unit-тесты не запускаются** (баг тулчейна, не кода) | `testDebugUnitTest` падает с `ClassNotFoundException` на самом тест-классе: AGP 9.2.1 + built-in Kotlin (`built_in_kotlinc`) не подключает каталог `transformDebugUnitTestClassesWithAsm/dirs` в classpath воркера. Тест-КОД исправлен и компилируется (сигнатуры `register`, конструкторы `Auth/ActionLog/TodayViewModel`, `AuthUiState.SuccessNoGarden`). Рабочая проверка Android — `compileDebugKotlin`; логику покрывает backend-сьют (169/169). Чинить = трогать тулчейн (обход ASM/coverage или даунгрейд AGP до 8.x). |

---

## Сделано за сессию 2026-06-04 (вторая: промокоды + архив сезонов)

### Промокоды — бесплатный доступ по коду
- **Бэкенд** (задеплоен, тесты **157 passed**): миграция `017_promo_codes.sql` (`users.promo_until` +
  таблица `promo_codes`), `access.js` (`hasPromo`/`isLifetimePromo`, `hasAccess` += промо),
  роут `POST /promo/redeem` (атомарный claim, 404/409), `/auth/me` отдаёт `promo_active`/`promo_lifetime`.
  Промо в ОТДЕЛЬНОЙ колонке `promo_until` — синк RuStore `{active:false}` его не затирает.
- **Два типа**: `lifetime` (навсегда), `month` (30 дней, продлевается). Коды одноразовые.
- **Скрипт генерации**: `backend/scripts/gen-promo.js <lifetime|month> [count]` → коды `DACHA-XXXX-XXXX`.
  ⚠️ После миграции на VPS: `ALTER TABLE promo_codes OWNER TO dacha_user;` (иначе permission denied).
- **Android**: поле «Есть промокод?» на Paywall, `redeemPromo` через `SubscriptionManager`
  (`PromoRedeemResponse`), `isAccessAllowed` += `isPromo`; статус в Настройках (`подписка→промо→триал`).
- **4 UX-фикса Paywall** (commit `e54ae43`): `imePadding` (клавиатура не перекрывает поле);
  Toast-подтверждение перед переходом; **навигация по явному `accessGranted`, не по ambient-статусу**
  (Paywall/«Купить» больше не выбрасывают при активном доступе); кнопка «Купить» скрыта при доступе.

### Способ посадки: рассада vs прямой посев в грунт
- **Новое поле** `plantings.sowing_method` (`seedling`/`direct`, миграция `022`); выбор при создании
  (дефолт по `transplant_days` культуры) и в редактировании. Стадия `sprouted` («Взошло») удалена.
- **Прямой посев**: нет напоминания/строки/стадии «Высажено в грунт»; `harvest_due` считается прямо по
  `harvest_days` (растёт в грунте с посева). **Рассада**: высадка → стадия `transplanted`, подкормка
  трактует `transplanted` как `growing`. Гейты в `todayLogic.js` + `careRemindersJob.js` (раньше слал
  «пора высаживать» даже для прямого посева через 14 дн.). Тесты **168 passed**.

### Расписание работ: предстоящие поливы
- `buildSchedule` (`PlantingInfoBottomSheet`) теперь добавляет ⚪ «💧 Полив» каждые `interval` дней
  (теплица ×0.8), только будущие (прошлые видны в «Истории действий»), горизонт ≤120 дн / ≤40 строк.
  Раньше полив в расписании не показывался вовсе — у культур без care_tasks (27 из 45) оно было пустым.
- ✅ **care_tasks засеяны для всех 27 культур** без ухода (миграция `020`): бахчевые, поздние капусты,
  зелень, ягодные кусты, корнеплоды, цветы. Препарат «Обработка от мучнистой росы» добавлен в
  `CARE_TASK_PRODUCT`. Теперь у всех 45 культур расписание содержит операции ухода.
- ✅ **Агрономическая выверка тайминга** (миграция `021`, все 45 культур): `day_offset` от ДАТЫ ПОСЕВА,
  у рассадных культур стадийные работы сдвинуты на `+transplant_days` (не попадают в рассаду),
  у прямого посева — от всходов. Первое наступление < harvest_days. Добавлены препараты «от тли»,
  «от колорадского жука» в `CARE_TASK_PRODUCT`. 021 заменяет тайминги 008/020.

### Параметры посадки: тип (грунт/теплица) и количество
- **Единый расчёт полива** `wateringIntervalDays(freqDays, conditions)` в `utils/todayLogic.js` —
  теплица поливается ЧАЩЕ (×0.8 к интервалу, было ×1.3 «реже» + 3 разных округления). Используется в
  `today`, `careRemindersJob` и зеркально в Android `CalendarViewModel`.
- **Теплица защищает от заморозков**: per-посадочный `frost_alert` в задачах дня не показывается для
  `conditions='greenhouse'` (пуш на участок остаётся — общий «холодно ночью»).
- **Ожидаемый урожай**: миграция `019` — `crops.yield_per_plant_kg` (сидинг 44 культур, цветы NULL).
  `GET /plantings(/:id)` отдаёт поле; на «Информации о посадке» строка «Ожидаемый урожай ~X кг» =
  `quantity × yield_per_plant_kg`. Тесты **165 passed**.

### Промокоды — срок действия + покупка при промо (доработка)
- **Миграция 018**: `duration_days` (NULL=lifetime, иначе N дней) + `expires_at` (дедлайн активации).
  `redeem` → 410 `code_expired` для истёкших; срок доступа по `duration_days`. `/auth/me` отдаёт `promo_until`.
- **Скрипт**: `gen-promo.js <lifetime|month|days N> [count] [--expires=YYYY-MM-DD]`.
- **Android**: дата окончания в Настройках/Paywall (`formatPromoDate`), бейдж «Промокод активен до …»;
  кнопка «Купить» снова доступна во время промо (скрыта только при активной подписке).

### Архив завершённых сезонов
- «Завершить сезон» (`stage='done'`) теперь даёт настоящий архив: «Все» показывает только активные,
  добавлен чип «Завершённые» (только если архив непуст). `PlantingsViewModel.filteredPlantings`/`hasArchived`.

---

## Сделано за сессию 2026-06-04 (просрочка ухода на «Посадках»)

Серия багфиксов + доработок по уходу за посадками (бэкенд задеплоен, тесты **147 passed**):

- **Просрочка ухода на карточках «Посадок»**: `GET /plantings` отдаёт `overdue_care_task`
  `{ name, days_overdue, product }` по каждой посадке (`getOverdueCareTask` в `todayLogic.js`) —
  независимо от обрезанного/сгруппированного кэша «Сегодня». Раньше сгруппированные/просроченные
  care-задачи на «Посадках» не показывались.
- **Снятие pending корректно**: с карточки списываем pending только если залогированный тип реально
  закрывает задачу → не «пропадает и возвращается» после перезагрузки.
- **Маппинг care-задач по ключевому слову** (`careTaskActionType`, бэкенд+Android): описательные имена
  («Первое окучивание», «Обработка от капустной мухи», «Обрезка нижних листьев») теперь закрываются.
  Добавлен тип **`treatment`** в маппинг и в SQL-фильтры care-действий (today.js/plantings.js).
- **Препарат для обработки**: `CARE_TASK_PRODUCT` в `todayLogic.js` → `overdue_care_task.product`;
  на карточке «Препарат: …», авто-подстановка в заметку при «Обработке».
- **Заметка**: имя действия в заметку НЕ пишем (`treatmentNote`); авто-подставляем только осмысленное
  (препарат/удобрение), реактивно (исчезает при смене действия), `auto=false` → видно в журнале.
- **Бейдж «Посадки» из серверных данных**: считается во ViewModel по тем же данным, что и карточки
  (`saveAttentionCount`) → бейдж и карточки не расходятся.
- **«Сегодня» по ON_RESUME**: действия с других экранов сразу видны в «Сделано сегодня».
- **«Информация о посадке»**: в расписании работ выполненные приглушены, просроченные — красным.
- **UI «Посадки»**: убран двойной нижний инсет (пустой отступ), эмодзи в меню карточки убраны.
- **Git-модель зафиксирована**: VPS — read-only зеркало `origin/main`, деплой через
  `git fetch + reset --hard origin/main` (не `git pull`) — в `CLAUDE.md` и `CONVENTIONS.md §12`.

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
POST /auth/verify-email  POST /auth/resend-verification
POST /auth/forgot-password  POST /auth/reset-password
POST /promo/redeem
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
