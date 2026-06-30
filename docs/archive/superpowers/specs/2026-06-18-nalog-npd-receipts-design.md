# Автоматическая регистрация чеков НПД через «Мой налог» (ФНС)

**Дата:** 2026-06-18
**Статус:** дизайн утверждён
**Контекст:** с 29.12.2025 сервис ЮKassa «Чеки для самозанятых» прекращён. Приём платежей через
ЮKassa работает без изменений, но регистрацию дохода в ФНС и отправку чека НПД (422-ФЗ) самозанятый
теперь должен делать сам. Цель — автоматизировать это через неофициальный API «Мой налог»
(`lknpd.nalog.ru`), пристыковав к существующему биллингу.

## Принятые решения (brainstorming)

| Вопрос | Решение |
|---|---|
| Российский IP (сервер на Hetzner/Германия, ФНС режет не-РФ) | RU forward-прокси; есть свой хостинг в РФ |
| Роль RU-хоста | Простой forward-прокси (HTTP/SOCKS); вся логика и БД остаются в `dacha-api` |
| Клиент к API | Свой тонкий `nalogService.js` (без сторонней библиотеки) |
| Момент регистрации | Через очередь + фоновый cron-воркер (не синхронно в webhook) |
| Хранение `refreshToken` | В БД (таблица `nalog_auth`) |
| Чек покупателю | Слать ссылку на чек НПД по email через существующий `emailService` |
| Бэкфилл прошлых платежей | Не нужен — платежей через ЮKassa ещё не было |
| Хранение очереди | Колонки `npd_*` в существующей таблице `payments` (вариант A) |

## Неофициальный API «Мой налог» — справка

- База: `https://lknpd.nalog.ru/api/v1` (недокументированный приватный REST веб-кабинета).
- Авторизация: Bearer access-токен (~1 час) + долгоживущий `refreshToken`.
  - Обновление: `POST /auth/token` с `refreshToken` и `deviceInfo`.
  - Первичная по телефону: phone-challenge → SMS → `token` + `refreshToken`.
- Создание чека: `POST /income`, ответ содержит `approvedReceiptUuid`.
- Отмена чека: `POST /cancel` (по `receiptUuid` + причина: `CANCEL` / `REFUND`).
- Ссылка на печать чека: `https://lknpd.nalog.ru/api/v1/receipt/<INN>/<receiptUuid>/print`.
- Ограничения: ≤ 2 запросов/мин с одного IP; таймаут ≥ 60с; синхронизация времени сервера
  обязательна (расхождение часов → отказ); годовой лимит дохода НПД 2,4 млн ₽.

Формат `POST /income`:
```json
{
  "paymentType": "CASH",
  "ignoreMaxTotalIncomeRestriction": false,
  "client": { "contactPhone": null, "displayName": null, "incomeType": "FROM_INDIVIDUAL", "inn": null },
  "requestTime": "<ISO-8601 c TZ>",
  "operationTime": "<ISO-8601, момент оплаты>",
  "services": [ { "name": "<описание услуги>", "amount": 299.00, "quantity": 1 } ],
  "totalAmount": "299.00"
}
```

## Архитектура и поток данных

Регистрация чеков — асинхронная подсистема. Webhook ЮKassa не знает о ФНС: он помечает платёж к
регистрации. Отдельный cron-воркер разгребает очередь через RU-прокси. Webhook остаётся единственным
источником истины по факту оплаты (как у `renewalJob`); воркер только инициирует операции в ФНС и
идемпотентен.

```
ЮKassa ──payment.succeeded──▶ billing.js webhook
                                  │ payments.status='succeeded', npd_status='pending'
                                  ▼
                          (cron) nalogJob ──через RU-proxy──▶ lknpd.nalog.ru /income
                                  │  ← approvedReceiptUuid
                                  │  payments.npd_status='registered', npd_receipt_uuid=...
                                  ▼
                          emailService.sendReceiptLink ──▶ покупатель (ссылка на чек)

ЮKassa ──refund.succeeded──▶ billing.js webhook (уже отзывает доступ)
                                  │ если есть npd_receipt_uuid → npd_status='cancel_pending'
                                  ▼
                          (cron) nalogJob ──▶ /cancel (REFUND) → npd_status='canceled'
```

## Компоненты

### `backend/src/services/nalogService.js`
Тонкий клиент к `lknpd.nalog.ru/api/v1` в стиле `yookassaService.js`.
- Включается наличием `NALOG_INN` + `NALOG_PROXY_URL` (+ refreshToken в БД). Без них
  `isEnabled() = false`, воркер пропускается (паттерн ЮKassa/почты/пушей).
- `node-fetch` + `https-proxy-agent` (новая зависимость) поверх RU-прокси; таймаут 60с;
  `AbortController`.
- Access-токен кэшируется в памяти с `tokenExpireIn`; рефреш через `refreshToken` из БД при истечении
  или на `401` (один ретрай). Если ФНС вернула новый `refreshToken` — перезаписать в БД.
- Методы:
  - `isEnabled()`
  - `addIncome({ name, amount, quantity, operationTime }) → receiptUuid`
  - `cancelIncome(receiptUuid, reason)` (`reason ∈ {CANCEL, REFUND}`)
  - `getReceiptUrl(receiptUuid) → string`
  - внутр. `getAccessToken()` / `refresh()`
  - `buildIncomeBody(...)` — чистая функция (тестируемость): `incomeType='FROM_INDIVIDUAL'`,
    `paymentType='CASH'`, пустой `client` (анонимный чек физлицу), суммы строкой с 2 знаками.

### `backend/src/jobs/nalogJob.js`
Cron-воркер (как `renewalJob`), интервал каждые 5 минут (env-настраиваемый).
- Claim-запрос `UPDATE payments SET ... WHERE npd_status='pending' ... RETURNING` — защита от двойной
  обработки при перекрытии прогонов. Батч ≤ 2 операции за прогон (rate-limit 2/мин).
- `pending` → `addIncome` → сохранить `npd_receipt_uuid`, `npd_status='registered'`,
  `npd_registered_at`; затем `emailService.sendReceiptLink`.
- `cancel_pending` → `cancelIncome(uuid, REFUND)` → `npd_status='canceled'`.
- Ретраи: инкремент `npd_attempts`, запись `npd_last_error`; бэкофф (пропуск при недавней ошибке);
  после 5 попыток → `npd_status='failed'` + письмо на `ADMIN_EMAIL`.

### `backend/src/services/emailService.js`
Добавить `sendReceiptLink(to, receiptUrl, description, amount)` поверх `sendMail` (стиль `codeHtml`).

### `backend/scripts/nalog-auth.js`
Одноразовый интерактивный bootstrap: phone-challenge + ввод SMS → получить `refreshToken` → записать
в `nalog_auth`. Ходит через тот же RU-прокси.

## Изменения данных (миграция `0XX_nalog_receipts.sql`)
С `ALTER TABLE ... OWNER TO dacha_user` (правило из migration 024).
- В `payments`:
  - `npd_status TEXT` — `pending` | `registered` | `cancel_pending` | `canceled` | `failed`;
    NULL = не подлежит регистрации.
  - `npd_receipt_uuid TEXT`
  - `npd_attempts INT NOT NULL DEFAULT 0`
  - `npd_last_error TEXT`
  - `npd_registered_at TIMESTAMPTZ`
- Индекс: `idx_payments_npd ON payments(npd_status) WHERE npd_status IN ('pending','cancel_pending')`.
- Таблица `nalog_auth` (одна строка): `id` (PK, всегда 1), `refresh_token TEXT`, `inn TEXT`,
  `updated_at TIMESTAMPTZ`.

## Изменения в `billing.js`
- `payment.succeeded` (текущая ~строка 141): в тот же `INSERT/UPDATE payments` добавить
  `npd_status='pending'` (только если `nalog.isEnabled()`).
- `refund.succeeded` (текущая ~строка 94): если у платежа есть `npd_receipt_uuid` — выставить
  `npd_status='cancel_pending'`.
- Регистрация `startNalogJob` в точке старта сервера рядом с `startRenewalJob`.

## Конфиг (`.env.example`)
- `NALOG_INN` — ИНН самозанятого.
- `NALOG_PHONE` — телефон для bootstrap/реавторизации.
- `NALOG_PROXY_URL` — напр. `http://user:pass@ru-host:port`.
- `NALOG_RECEIPT_INTERVAL` (опц.) — интервал воркера.
- Доступ включается автоматически при наличии ключей (как ЮKassa).

## Обработка ошибок
- ФНС/прокси недоступны → платёж остаётся `pending`, webhook уже отдал 200, воркер повторит.
- `429` → бэкофф; `401` → рефреш + ретрай; рефреш упал (токен отозван) → остаётся `pending`
  + письмо админу «переавторизуйся» (`scripts/nalog-auth.js`).
- Годовой лимит 2,4 млн ₽ → `addIncome` отклонит → `failed` + письмо админу.
- Идемпотентность через `npd_status` + claim-UPDATE; `operationTime` = `payments.created_at`.
- NTP на VPS обязателен (ФНС отвергает запрос при расхождении часов) — отметить в `docs/DEPLOY.md`.

## Тесты (vitest, `npm test`)
- `nalogService.test.js`: `buildIncomeBody` (поля/формат сумм), логика рефреша токена с инъекцией
  `fetch`, поведение при `isEnabled()=false`.
- `nalogJob.test.js`: обработка `pending`/`cancel_pending`, ретраи/`failed`, claim-идемпотентность —
  с инъекцией сервиса и `db` (как в `renewalJob`/`billing` тестах).
- `emailService`: `sendReceiptLink` формирует письмо.

## Вне scope (YAGNI)
Бэкфилл прошлых платежей (их нет), внешняя очередь (Redis/BullMQ), авто-ротация прокси,
поддержка нескольких ИНН.

## Риски
- API «Мой налог» неофициальный: ФНС может менять/ломать его без предупреждения. Изоляция в
  `nalogService` ограничивает зону поломки.
- Зависимость от стабильности RU-прокси. Сбой → чеки копятся в `pending`, не теряются.
