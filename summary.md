# Статус и бэклог: «Календарь дачника»

> История сессий — `session-note.md` (+ `session-note-archive.md`).
> Отложенные задачи этапа 2+ — `docs/ux-roadmap.md` (единый источник).
> Конвенции кода — `android/CONVENTIONS.md`; деплой — `docs/DEPLOY.md`; инструкции — `CLAUDE.md`.

## Текущий статус

- **MVP**: ✅ 100% завершён, в проде. Идёт пост-MVP-разработка.
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL · Android (Kotlin + Compose + Hilt) · Веб (React + Vite + TS + Tailwind).
- **Бэкенд**: `https://dacha.studio1008.com/` · pm2 `dacha-api`.
- **Веб**: `https://dacha.studio1008.com/app/` (папка `web/`, статика `/var/www/dacha-web`, nginx `location /app/`). Та же БД/API.
- **Android**: package `ru.dachakalend.app` · minSdk 26 · compileSdk/targetSdk **36** (Android 16) · флейворы `rustore`/`gplay`/`samsung` (сборка `:app:compileGplayDebugKotlin` и т.п.).
- **Справочник проблем растений**: в проде на всех платформах (~68 записей, 52/68 с фото). См. `docs/plant-guide-plan.md`.
- **Бэкенд-тесты**: 264/264.

## Монетизация (ФИНАЛ 2026-06-16)

Web + Google Play + RuStore — **все платная подписка «Дачник Про», 7 дней триал, БЕЗ рекламы.**
Samsung снят с публикации. Оплата — **ЮKassa напрямую** (Shop ID 1376599), **разовые платежи**
(рекуррент запрещён самозанятому → продление вручную); доступ продлевает вебхук `/billing/webhook`.
Чек — НПД (422-ФЗ). Серверный гейт: `utils/access.js` `hasAccess` (триал/`subscription_until`/промо),
`requireAccess` → 402. Рекламной модели (Yandex Ads / РСЯ) больше нет — выпилена вместе с Samsung.
⚠️ Код samsung-флейвора в Android ещё не удалён (не срочно, флейвор просто не публикуется).

## Актуальные открытые задачи

**✅ Задеплоено 2026-06-16** (`b8641ef` контактная почта + `9ffa82d` шапка лендинга): VPS на `52dfb5d`,
лендинг и веб пересобраны/выложены, `/` и `/app/` отдают 200, на сайте новый email `dacha@studio1008.com`.
- ⚠️ **Остаётся: завести почтовый ящик `dacha@studio1008.com`** — адрес уже опубликован на сайте, входящие письма пока могут не доставляться.

**Google Play (при публикации):**
- После первой загрузки AAB добавить **третий SHA-1** (Play Console → App integrity → App signing key certificate) в ограничение Firebase API-key — иначе FCM на Play-сборке не зарегистрируется. Debug+release SHA-1 уже добавлены.
- Заменить кнопки магазинов «Скоро» (`#download` `.store-btn[aria-disabled]`) и store-ссылки футера на реальные URL.
- Гайд: `docs/gplay-publishing-guide.md`. ASO-карточки: `docs/aso-gplay-samsung.md`, `docs/aso-rustore.md`.

**Безопасность/гигиена:**
- Сменить пароль тест-аккаунта `e-krukov@ya.ru` (светился в чате) — через «Забыли пароль?».

**P4 «Аккаунт и безопасность» — хвост (отдельные циклы):**
- C — смена города (`PUT /gardens/:id` готов, нужен UI).
- D — управление участками + переключатель активного сада.
- Уведомления на web.

**Технический долг:**
- **E3**: Android unit-тесты не запускаются (`testDebugUnitTest` → `ClassNotFoundException`, баг тулчейна AGP 9.2.1 + built-in Kotlin, не код). Рабочая проверка — `:app:compile*Kotlin`; логику покрывает backend-сьют.

**«Could» из ТЗ:**
- §5.8 сравнение урожая по сезонам · §5.2 профиль участка (отдельный экран) · §5.1 поля участка (площадь, тип почвы).

**Этап 2+ (полный бэклог):** `docs/ux-roadmap.md` (хвост этапа 1 — Android-эмодзи; P5 изображения + фото-диагностика; P7 поиск культур; П8 десктоп-layout и др.).

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
