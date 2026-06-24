# Статус и бэклог: «Календарь дачника»

> История сессий — `session-note.md` (+ `session-note-archive.md`).
> Приоритизированный план доработок (техдолг/фиксы → фичи) — `docs/improvement-plan.md`.
> Отложенные задачи этапа 2+ — `docs/ux-roadmap.md` (единый источник).
> Конвенции кода — `android/CONVENTIONS.md`; деплой — `docs/DEPLOY.md`; инструкции — `CLAUDE.md`.

## Текущий статус

- **MVP**: ✅ 100% завершён, в проде. Идёт пост-MVP-разработка.
- **Стек**: Node.js 20 + Fastify 4 + PostgreSQL · Android (Kotlin + Compose + Hilt) · Веб (React + Vite + TS + Tailwind).
- **Бэкенд**: `https://dacha.studio1008.com/` · pm2 `dacha-api`.
- **Веб**: `https://dacha.studio1008.com/app/` (папка `web/`, статика `/var/www/dacha-web`, nginx `location /app/`). Та же БД/API.
- **Android**: package `ru.dachakalend.app` · minSdk 26 · compileSdk/targetSdk **36** (Android 16) · флейворы `rustore`/`gplay`/`samsung` (сборка `:app:compileGplayDebugKotlin` и т.п.).
- **Справочник проблем растений**: в проде на всех платформах (~68 записей, 52/68 с фото). См. `docs/plant-guide-plan.md`.
- **Бэкенд-тесты**: 356/356 (`npm test` → vitest run; **НЕ** jest).
- **Лента «Мой участок»**: запись-центричная (`action`/`photo`/`milestone`), единый блок «действие+заметка+фото»
  на ленте и в журнале посадки. В проде (`GET /feed`, без миграции). Android — vc6/1.0.3 (не опубликован).
- **Автопостер ВК** (маркетинг): очередь с расписанием `vk_post_queue` (миграция 048) + cron `vkQueueJob`,
  публикует посты из md-файла контента в сообщество `calendacha`. Нужен ПОЛЬЗОВАТЕЛЬСКИЙ VK-токен. Ops — `docs/DEPLOY.md`.
- ⚠️ **Android JVM unit-тесты не запускаются в этом окружении** — кириллический путь `Календарь дачника`
  ломает тест-воркер (`ClassNotFoundException` для всех классов; давний «E3»). Верификация Android =
  компиляция main + тест-исходников (`:app:compile<Flavor>DebugUnitTestKotlin`); прогон тестов — в
  Android Studio / на ASCII-пути.
- **F1 офлайн «Сегодня»** (Android+backend): реализован в ветке `feature/offline-today`, **НЕ задеплоен**
  (read-кэш + очередь записи; миграция 045). См. session-note (2026-06-21).

## Монетизация (ФИНАЛ 2026-06-16)

Web + Google Play + RuStore — **все платная подписка «Дачник Про», 7 дней триал, БЕЗ рекламы.**
Samsung снят с публикации. Оплата — **ЮKassa напрямую** (Shop ID 1376599), **разовые платежи**
(рекуррент запрещён самозанятому → продление вручную); доступ продлевает вебхук `/billing/webhook`.
Чек — НПД (422-ФЗ): **авто-регистрируется в «Мой налог»** через `lknpd.nalog.ru` (сервис ЮKassa «Чеки
для самозанятых» прекращён 29.12.2025). Поток: webhook → `payments.npd_status` → cron `nalogJob` →
`addIncome` через RU-релей (`nalog-relay.php` на reg.ru, `NALOG_RELAY_URL`) → письмо с чеком. Детали —
`docs/DEPLOY.md` («Мой налог») и `session-note.md` (2026-06-19). ⚠️ `YOOKASSA_RECEIPT_MODE=off`.
✅ **E2E подтверждён реальным платежом 19.06.2026** (payment 7 → `registered`). По пути исправлены 2 бага:
релей терял токен ФНС (Apache режет `Authorization` → шлём токен в `X-Relay-Auth`) и `scp` затирал секрет
релея (теперь секрет в файле `.relay-secret`, не в гите). Секрет `NALOG_RELAY_SECRET` ротирован. Детали — session-note (2).
Серверный гейт: `utils/access.js` `hasAccess` (триал/`subscription_until`/промо),
`requireAccess` → 402. Рекламной модели (Yandex Ads / РСЯ) больше нет — выпилена вместе с Samsung.
⚠️ Код samsung-флейвора в Android ещё не удалён (не срочно, флейвор просто не публикуется).

## Актуальные открытые задачи

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
- После первой загрузки AAB добавить **третий SHA-1** (Play Console → App integrity → App signing key certificate) в ограничение Firebase API-key — иначе FCM на Play-сборке не зарегистрируется. Debug+release SHA-1 уже добавлены.
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
- ⚠️ **Открыть приложение на тест-устройстве** — текущий FCM-токен мёртв, нужен свежий (re-register).
- ⏳ **Google Play**: добавить **третий SHA-1** (App signing key certificate, Play Console) в ограничение
  Firebase API-key (Google Cloud Console) — иначе FCM на Play-сборке не зарегистрируется.

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
