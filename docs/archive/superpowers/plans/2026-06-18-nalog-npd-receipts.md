# Автоматическая регистрация чеков НПД («Мой налог») — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автоматически регистрировать доход в ФНС и формировать чек НПД на каждый успешный платёж ЮKassa, отправляя покупателю ссылку на чек; при возврате — аннулировать чек.

**Architecture:** Асинхронная подсистема поверх существующего биллинга. Webhook ЮKassa лишь помечает платёж (`payments.npd_status='pending'`); отдельный cron-воркер (`nalogJob`) разгребает очередь через тонкий клиент `nalogService` к неофициальному API `lknpd.nalog.ru`, ходящий через RU forward-прокси. Webhook остаётся единственным источником истины по факту оплаты (как `renewalJob`).

**Tech Stack:** Node.js, Fastify, PostgreSQL (`pg`), `node-fetch@2`, `https-proxy-agent`, `node-cron`, vitest.

**Спека:** `docs/superpowers/specs/2026-06-18-nalog-npd-receipts-design.md`

**Конвенции проекта (важно):**
- Тесты — vitest, запуск `npm test` (в каталоге `backend`).
- Сервисы по паттерну `yookassaService.js`: `isEnabled()` по env, no-op/throw без ключей.
- Джобы по паттерну `renewalJob.js`: `startXJob(db)` (cron) + тестируемый `runX(db, deps)`.
- Миграции — нумерованные `.sql` в `backend/src/db/migrations/`, после `CREATE TABLE` обязательно `ALTER TABLE ... OWNER TO dacha_user` (грабли из 024).
- Все команды запускать из `C:\Projects\Dacha\Календарь дачника\backend`.

---

## Task 1: Зависимость https-proxy-agent + миграция 040

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/db/migrations/040_nalog_receipts.sql`

- [ ] **Step 1: Установить https-proxy-agent**

Run (в `backend`): `npm install https-proxy-agent@^7.0.0`
Expected: `package.json` → `dependencies` содержит `"https-proxy-agent": "^7.0.0"`, без ошибок.

- [ ] **Step 2: Написать миграцию 040**

Create `backend/src/db/migrations/040_nalog_receipts.sql`:

```sql
-- Migration 040: Регистрация чеков НПД через «Мой налог» (ФНС)
-- Run (на VPS под postgres): sudo -u postgres psql -d dacha_db -f 040_nalog_receipts.sql
-- ВАЖНО после миграции: sudo -u postgres psql -d dacha_db -c "ALTER TABLE nalog_auth OWNER TO dacha_user;"
--
-- Контекст: сервис ЮKassa «Чеки для самозанятых» прекращён 29.12.2025. Доход в ФНС и чек НПД
-- регистрируем сами через API lknpd.nalog.ru. Очередь регистрации — колонки npd_* в payments.

-- Статус регистрации чека НПД по платежу:
--   NULL           — не подлежит (платёж до подключения / nalog отключён)
--   pending        — оплачен, ждёт регистрации дохода
--   registered     — доход зарегистрирован, чек сформирован (npd_receipt_uuid заполнен)
--   cancel_pending — был возврат, ждёт аннулирования чека
--   canceled       — чек аннулирован
--   failed         — регистрация/аннулирование не удались после ретраев (см. npd_last_error)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_status        TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_receipt_uuid  TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_attempts      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_last_error    TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS npd_registered_at TIMESTAMPTZ;

-- Частичный индекс: быстрый разбор очереди (только активные статусы).
CREATE INDEX IF NOT EXISTS idx_payments_npd ON payments(npd_status)
  WHERE npd_status IN ('pending', 'cancel_pending');

-- Учётные данные «Мой налог»: одна строка (id=1). refresh_token живёт долго, access-токен
-- получаем из него в рантайме. inn — информационно (основной источник ИНН — env NALOG_INN).
CREATE TABLE IF NOT EXISTS nalog_auth (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  refresh_token TEXT,
  inn           TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT nalog_auth_single_row CHECK (id = 1)
);
INSERT INTO nalog_auth (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE nalog_auth OWNER TO dacha_user;
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/db/migrations/040_nalog_receipts.sql
git commit -m "feat(nalog): миграция 040 (очередь npd_* в payments + nalog_auth) и https-proxy-agent"
```

---

## Task 2: nalogService — чистые функции buildIncomeBody и toMoscowISO

**Files:**
- Create: `backend/src/services/nalogService.js`
- Test: `backend/src/__tests__/nalogService.test.js`

- [ ] **Step 1: Написать падающий тест**

Create `backend/src/__tests__/nalogService.test.js`:

```js
'use strict'

const nalog = require('../services/nalogService')

describe('nalogService.toMoscowISO', () => {
  it('форматирует UTC в МСК (+03:00)', () => {
    // 2026-06-18T09:00:00Z = 12:00 МСК
    const s = nalog.toMoscowISO(new Date('2026-06-18T09:00:00.000Z'))
    expect(s).toBe('2026-06-18T12:00:00+03:00')
  })
})

describe('nalogService.buildIncomeBody', () => {
  it('формирует тело /income для анонимного чека физлицу', () => {
    const op = new Date('2026-06-18T09:00:00.000Z')
    const body = nalog.buildIncomeBody({
      name: 'Подписка «Календарь дачника» — 1 месяц',
      amount: 299,
      quantity: 1,
      operationTime: op
    })
    expect(body.paymentType).toBe('CASH')
    expect(body.ignoreMaxTotalIncomeRestriction).toBe(false)
    expect(body.client).toEqual({ contactPhone: null, displayName: null, incomeType: 'FROM_INDIVIDUAL', inn: null })
    expect(body.operationTime).toBe('2026-06-18T12:00:00+03:00')
    expect(body.services).toEqual([{ name: 'Подписка «Календарь дачника» — 1 месяц', amount: 299, quantity: 1 }])
    expect(body.totalAmount).toBe('299.00')
    expect(typeof body.requestTime).toBe('string')
  })

  it('totalAmount = amount * quantity с двумя знаками', () => {
    const body = nalog.buildIncomeBody({ name: 'X', amount: 1990, quantity: 1, operationTime: new Date() })
    expect(body.totalAmount).toBe('1990.00')
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/__tests__/nalogService.test.js`
Expected: FAIL — `nalog.toMoscowISO is not a function` (модуля/функций ещё нет).

- [ ] **Step 3: Создать nalogService с чистыми функциями**

Create `backend/src/services/nalogService.js`:

```js
'use strict'

const fetch = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')

// Тонкий клиент к неофициальному API «Мой налог» (lknpd.nalog.ru/api/v1).
// Регистрация дохода НПД (422-ФЗ) после прекращения сервиса ЮKassa «Чеки для самозанятых» (29.12.2025).
// Включается заданием NALOG_INN + NALOG_PROXY_URL (+ refresh_token в таблице nalog_auth). Без них
// isEnabled()=false → nalogJob пропускается (паттерн ЮKassa/почты/пушей).
// ФНС режет не-РФ IP → все запросы идут через RU forward-прокси (NALOG_PROXY_URL).

const API_BASE = () => process.env.NALOG_API || 'https://lknpd.nalog.ru/api/v1'

// ФНС ожидает время в зоне МСК со смещением +03:00 (на сервере время UTC).
function toMoscowISO(date) {
  const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${msk.getUTCFullYear()}-${p(msk.getUTCMonth() + 1)}-${p(msk.getUTCDate())}` +
         `T${p(msk.getUTCHours())}:${p(msk.getUTCMinutes())}:${p(msk.getUTCSeconds())}+03:00`
}

// Тело запроса POST /income. Анонимный чек физлицу: client с null-полями, incomeType FROM_INDIVIDUAL.
function buildIncomeBody({ name, amount, quantity = 1, operationTime }) {
  const now = new Date()
  const op = operationTime instanceof Date ? operationTime : new Date(operationTime)
  return {
    paymentType: 'CASH',
    ignoreMaxTotalIncomeRestriction: false,
    client: { contactPhone: null, displayName: null, incomeType: 'FROM_INDIVIDUAL', inn: null },
    requestTime: toMoscowISO(now),
    operationTime: toMoscowISO(op),
    services: [{ name, amount, quantity }],
    totalAmount: (amount * quantity).toFixed(2)
  }
}

module.exports = { toMoscowISO, buildIncomeBody, API_BASE }
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx vitest run src/__tests__/nalogService.test.js`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/nalogService.js backend/src/__tests__/nalogService.test.js
git commit -m "feat(nalog): buildIncomeBody и toMoscowISO (чистые функции)"
```

---

## Task 3: nalogService — токен, HTTP-вызовы, addIncome/cancelIncome

**Files:**
- Modify: `backend/src/services/nalogService.js`
- Test: `backend/src/__tests__/nalogService.test.js`

- [ ] **Step 1: Дописать падающие тесты**

Добавь в конец `backend/src/__tests__/nalogService.test.js`:

```js
describe('nalogService.isEnabled', () => {
  afterEach(() => { delete process.env.NALOG_INN; delete process.env.NALOG_PROXY_URL })

  it('off без ключей', () => {
    expect(nalog.isEnabled()).toBe(false)
  })
  it('on при NALOG_INN + NALOG_PROXY_URL', () => {
    process.env.NALOG_INN = '123456789012'
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    expect(nalog.isEnabled()).toBe(true)
  })
})

describe('nalogService.addIncome / cancelIncome (с инъекцией fetch)', () => {
  afterEach(() => { delete process.env.NALOG_PROXY_URL; nalog._resetToken() })

  function makeDb(refreshToken = 'rt_1') {
    return {
      updates: [],
      async query(sql, params) {
        if (sql.includes('SELECT refresh_token FROM nalog_auth')) {
          return { rows: [{ refresh_token: refreshToken }] }
        }
        if (sql.includes('UPDATE nalog_auth SET refresh_token')) {
          this.updates.push(params)
          return { rows: [] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  it('addIncome: получает токен, постит /income, возвращает approvedReceiptUuid', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const calls = []
    const fakeFetch = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc_1', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/income')) {
        return { ok: true, status: 200, json: async () => ({ approvedReceiptUuid: 'rcpt_abc' }) }
      }
      throw new Error('unexpected url ' + url)
    }
    const uuid = await nalog.addIncome(makeDb(), {
      name: 'Подписка', amount: 299, quantity: 1, operationTime: new Date('2026-06-18T09:00:00Z')
    }, fakeFetch)
    expect(uuid).toBe('rcpt_abc')
    expect(calls[0].url).toContain('/auth/token')
    expect(calls[0].body.refreshToken).toBe('rt_1')
    expect(calls[1].url).toContain('/income')
    expect(calls[1].body.totalAmount).toBe('299.00')
  })

  it('addIncome: на 401 обновляет токен и повторяет запрос один раз', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    let incomeCalls = 0
    const fakeFetch = async (url) => {
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/income')) {
        incomeCalls++
        if (incomeCalls === 1) return { ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) }
        return { ok: true, status: 200, json: async () => ({ approvedReceiptUuid: 'rcpt_retry' }) }
      }
      throw new Error('unexpected url ' + url)
    }
    const uuid = await nalog.addIncome(makeDb(), { name: 'X', amount: 1, quantity: 1, operationTime: new Date() }, fakeFetch)
    expect(uuid).toBe('rcpt_retry')
    expect(incomeCalls).toBe(2)
  })

  it('addIncome: нет refresh_token → ошибка с подсказкой про bootstrap', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const db = { async query() { return { rows: [{ refresh_token: null }] } } }
    await expect(
      nalog.addIncome(db, { name: 'X', amount: 1, quantity: 1, operationTime: new Date() }, async () => {})
    ).rejects.toThrow(/nalog-auth/)
  })

  it('cancelIncome: постит /cancel с receiptUuid и причиной', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const calls = []
    const fakeFetch = async (url, opts) => {
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/cancel')) {
        calls.push(JSON.parse(opts.body))
        return { ok: true, status: 200, json: async () => ({ incomeInfo: {} }) }
      }
      throw new Error('unexpected url ' + url)
    }
    await nalog.cancelIncome(makeDb(), 'rcpt_abc', 'REFUND', fakeFetch)
    expect(calls[0].receiptUuid).toBe('rcpt_abc')
    expect(calls[0].comment).toBe('REFUND')
  })
})

describe('nalogService.getReceiptUrl', () => {
  afterEach(() => { delete process.env.NALOG_INN })
  it('строит ссылку на печать чека по ИНН и uuid', () => {
    process.env.NALOG_INN = '123456789012'
    expect(nalog.getReceiptUrl('rcpt_abc'))
      .toBe('https://lknpd.nalog.ru/api/v1/receipt/123456789012/rcpt_abc/print')
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/nalogService.test.js`
Expected: FAIL — `nalog.isEnabled is not a function` и др.

- [ ] **Step 3: Дописать реализацию в nalogService.js**

Замени строку `module.exports = { toMoscowISO, buildIncomeBody, API_BASE }` в `backend/src/services/nalogService.js` на следующий блок (вставив код ПЕРЕД экспортом):

```js
const TIMEOUT_MS = 60000 // ФНС: таймаут ответа ≥ 60с

function isEnabled() {
  return !!(process.env.NALOG_INN && process.env.NALOG_PROXY_URL)
}

function getReceiptUrl(receiptUuid) {
  return `${API_BASE()}/receipt/${process.env.NALOG_INN}/${receiptUuid}/print`
}

// Стабильный идентификатор устройства (требуется API). Генерируется один раз в scripts/nalog-auth.js.
function deviceInfo() {
  return {
    appVersion: '1.0.0',
    sourceDeviceId: process.env.NALOG_DEVICE_ID || 'dacha000000000000000',
    sourceType: 'WEB',
    metaDetails: { userAgent: 'Mozilla/5.0' }
  }
}

// Кэш access-токена в памяти процесса.
let _accessToken = null
let _accessExp = 0
function _resetToken() { _accessToken = null; _accessExp = 0 } // только для тестов

// Низкоуровневый POST через RU-прокси с таймаутом. fetchImpl инъектируется в тестах.
async function npdPost(path, body, token, fetchImpl = fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetchImpl(`${API_BASE()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      agent: new HttpsProxyAgent(process.env.NALOG_PROXY_URL),
      signal: controller.signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(`Мой налог ${path}: HTTP ${res.status} ${data && data.message ? data.message : ''}`.trim())
      err.status = res.status
      throw err
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

// Возвращает действующий access-токен; при force или истечении — рефрешит по refresh_token из БД.
async function getAccessToken(db, fetchImpl = fetch, force = false) {
  if (!force && _accessToken && Date.now() < _accessExp - 60000) return _accessToken
  const row = (await db.query('SELECT refresh_token FROM nalog_auth WHERE id = 1')).rows[0]
  if (!row || !row.refresh_token) {
    throw new Error('Нет refreshToken «Мой налог» — выполните backend/scripts/nalog-auth.js')
  }
  const data = await npdPost('/auth/token', { deviceInfo: deviceInfo(), refreshToken: row.refresh_token }, null, fetchImpl)
  _accessToken = data.token
  const exp = data.tokenExpireIn ? Date.parse(data.tokenExpireIn) : NaN
  _accessExp = Number.isNaN(exp) ? Date.now() + 55 * 60000 : exp
  if (data.refreshToken && data.refreshToken !== row.refresh_token) {
    await db.query('UPDATE nalog_auth SET refresh_token = $1, updated_at = NOW() WHERE id = 1', [data.refreshToken])
  }
  return _accessToken
}

// Выполняет вызов с токеном; на 401 — один форс-рефреш и повтор.
async function callWithAuth(db, fetchImpl, doCall) {
  let token = await getAccessToken(db, fetchImpl)
  try {
    return await doCall(token)
  } catch (e) {
    if (e.status === 401) {
      token = await getAccessToken(db, fetchImpl, true)
      return await doCall(token)
    }
    throw e
  }
}

// Регистрирует доход. Возвращает approvedReceiptUuid.
async function addIncome(db, income, fetchImpl = fetch) {
  const body = buildIncomeBody(income)
  const data = await callWithAuth(db, fetchImpl, (token) => npdPost('/income', body, token, fetchImpl))
  return data.approvedReceiptUuid
}

// Аннулирует чек. reason: 'CANCEL' (ошибочный) | 'REFUND' (возврат).
async function cancelIncome(db, receiptUuid, reason, fetchImpl = fetch) {
  const body = {
    receiptUuid,
    comment: reason,
    operationTime: toMoscowISO(new Date()),
    requestTime: toMoscowISO(new Date()),
    partnerCode: null
  }
  return callWithAuth(db, fetchImpl, (token) => npdPost('/cancel', body, token, fetchImpl))
}

module.exports = {
  toMoscowISO, buildIncomeBody, API_BASE,
  isEnabled, getReceiptUrl, addIncome, cancelIncome, getAccessToken, _resetToken
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/nalogService.test.js`
Expected: PASS (все тесты файла).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/nalogService.js backend/src/__tests__/nalogService.test.js
git commit -m "feat(nalog): токен/refresh, addIncome, cancelIncome, getReceiptUrl через RU-прокси"
```

---

## Task 4: emailService.sendReceiptLink

**Files:**
- Modify: `backend/src/services/emailService.js`
- Test: `backend/src/__tests__/emailReceipt.test.js`

- [ ] **Step 1: Написать падающий тест**

Create `backend/src/__tests__/emailReceipt.test.js`:

```js
'use strict'

const email = require('../services/emailService')

describe('emailService.sendReceiptLink', () => {
  afterEach(() => { delete process.env.BREVO_API_KEY; delete process.env.UNISENDER_GO_API_KEY; delete process.env.SMTP_HOST; email._resetTransport() })

  it('почта отключена → возвращает false, не бросает', async () => {
    const ok = await email.sendReceiptLink('buyer@mail.ru', 'https://lknpd.nalog.ru/x/print', 'Подписка — 1 месяц', '299.00')
    expect(ok).toBe(false)
  })

  it('экспортируется как функция', () => {
    expect(typeof email.sendReceiptLink).toBe('function')
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/emailReceipt.test.js`
Expected: FAIL — `email.sendReceiptLink is not a function`.

- [ ] **Step 3: Реализовать sendReceiptLink**

В `backend/src/services/emailService.js` добавь функцию перед `module.exports`:

```js
async function sendReceiptLink(to, receiptUrl, description, amount) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#FF7B00">${APP_NAME()}</h2>
    <p>Спасибо за оплату! Сформирован чек на «${description}» на сумму ${amount} ₽.</p>
    <p><a href="${receiptUrl}" style="color:#FF7B00">Открыть чек</a></p>
    <p style="color:#888;font-size:13px">Чек сформирован в сервисе ФНС «Мой налог».</p>
  </div>`
  return sendMail(
    to,
    `Чек об оплате — ${APP_NAME()}`,
    `Спасибо за оплату «${description}» на сумму ${amount} ₽.\nЧек: ${receiptUrl}`,
    html
  )
}
```

И добавь `sendReceiptLink` в объект `module.exports` (рядом с `sendVerificationCode`):

```js
module.exports = {
  generateCode,
  sendMail,
  sendReceiptLink,
  sendVerificationCode,
  sendPasswordResetCode,
  _resetTransport
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/emailReceipt.test.js`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/emailService.js backend/src/__tests__/emailReceipt.test.js
git commit -m "feat(nalog): emailService.sendReceiptLink — письмо со ссылкой на чек НПД"
```

---

## Task 5: nalogJob — фоновый воркер очереди

**Files:**
- Create: `backend/src/jobs/nalogJob.js`
- Test: `backend/src/__tests__/nalogJob.test.js`

- [ ] **Step 1: Написать падающий тест**

Create `backend/src/__tests__/nalogJob.test.js`:

```js
'use strict'

const { runNalogReceipts } = require('../jobs/nalogJob')

const MAX_ATTEMPTS = 5

// Мок БД: отдаёт батч claim'ом, фиксирует UPDATE'ы.
function makeDb({ pending = [], cancel = [] } = {}) {
  const updates = []
  return {
    updates,
    async query(sql, params) {
      if (sql.includes("npd_status = 'pending'") && sql.includes('RETURNING')) {
        const rows = pending.splice(0, 2) // claim ≤ 2
        return { rows }
      }
      if (sql.includes("npd_status = 'cancel_pending'") && sql.includes('RETURNING')) {
        const rows = cancel.splice(0, 2)
        return { rows }
      }
      updates.push({ sql, params })
      return { rows: [] }
    }
  }
}

function makeNalog({ enabled = true, add, cancel } = {}) {
  return {
    isEnabled: () => enabled,
    addIncome: add || (async () => 'rcpt_default'),
    cancelIncome: cancel || (async () => ({})),
    getReceiptUrl: (uuid) => `https://lknpd.nalog.ru/api/v1/receipt/INN/${uuid}/print`
  }
}

function makeEmail() {
  const sent = []
  return { sent, sendReceiptLink: async (...a) => { sent.push(a); return true } }
}

describe('runNalogReceipts', () => {
  it('nalog отключён → no-op', async () => {
    const db = makeDb({ pending: [{ id: 1 }] })
    await runNalogReceipts(db, makeNalog({ enabled: false }), makeEmail())
    expect(db.updates.length).toBe(0)
  })

  it('pending → регистрирует чек, помечает registered, шлёт письмо', async () => {
    const db = makeDb({ pending: [{ id: 10, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date('2026-06-18T09:00:00Z') }] })
    const email = makeEmail()
    await runNalogReceipts(db, makeNalog({ add: async () => 'rcpt_10' }), email)
    const reg = db.updates.find(u => u.sql.includes("npd_status = 'registered'"))
    expect(reg).toBeTruthy()
    expect(reg.params).toContain('rcpt_10')
    expect(email.sent.length).toBe(1)
    expect(email.sent[0][0]).toBe('a@b.c')
  })

  it('cancel_pending → аннулирует чек, помечает canceled', async () => {
    const db = makeDb({ cancel: [{ id: 20, npd_receipt_uuid: 'rcpt_20' }] })
    let cancelled = null
    const nalog = makeNalog({ cancel: async (_db, uuid, reason) => { cancelled = { uuid, reason } } })
    await runNalogReceipts(db, nalog, makeEmail())
    expect(cancelled).toEqual({ uuid: 'rcpt_20', reason: 'REFUND' })
    expect(db.updates.some(u => u.sql.includes("npd_status = 'canceled'"))).toBe(true)
  })

  it('ошибка регистрации → инкремент attempts и npd_last_error (остаётся pending)', async () => {
    const db = makeDb({ pending: [{ id: 30, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date(), npd_attempts: 0 }] })
    const nalog = makeNalog({ add: async () => { throw new Error('ФНС недоступна') } })
    await runNalogReceipts(db, nalog, makeEmail())
    const errUpd = db.updates.find(u => u.sql.includes('npd_last_error') && !u.sql.includes("'failed'"))
    expect(errUpd).toBeTruthy()
    expect(errUpd.params.join(' ')).toContain('ФНС недоступна')
  })

  it('после MAX_ATTEMPTS ошибок → npd_status failed', async () => {
    const db = makeDb({ pending: [{ id: 40, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date(), npd_attempts: MAX_ATTEMPTS - 1 }] })
    const nalog = makeNalog({ add: async () => { throw new Error('опять ошибка') } })
    await runNalogReceipts(db, nalog, makeEmail())
    expect(db.updates.some(u => u.sql.includes("npd_status = 'failed'"))).toBe(true)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/nalogJob.test.js`
Expected: FAIL — `Cannot find module '../jobs/nalogJob'`.

- [ ] **Step 3: Реализовать nalogJob**

Create `backend/src/jobs/nalogJob.js`:

```js
'use strict'

const cron = require('node-cron')
const nalogService = require('../services/nalogService')
const emailService = require('../services/emailService')

const MAX_ATTEMPTS = 5

const PLAN_DESC = {
  monthly: 'Подписка «Календарь дачника» — 1 месяц',
  yearly: 'Подписка «Календарь дачника» — 1 год'
}

// Регистрация чеков НПД раз в 5 минут. Батч ≤ 2 за прогон (rate-limit ФНС 2 запроса/мин).
function startNalogJob(db) {
  cron.schedule('*/5 * * * *', () => { runNalogReceipts(db) })
  console.log('[nalog-job] Запущен: регистрация чеков НПД каждые 5 минут')
}

// deps инъектируются в тестах.
async function runNalogReceipts(db, nalog = nalogService, email = emailService) {
  if (!nalog.isEnabled()) {
    console.log('[nalog-job] «Мой налог» отключён — регистрация чеков пропущена')
    return
  }

  // 1) Аннулирование чеков по возвратам.
  const cancelRes = await db.query(
    `UPDATE payments SET npd_status = 'cancel_pending'
     WHERE npd_status = 'cancel_pending'
       AND id IN (SELECT id FROM payments WHERE npd_status = 'cancel_pending' ORDER BY created_at LIMIT 2)
     RETURNING id, npd_receipt_uuid`
  )
  for (const row of cancelRes.rows) {
    try {
      await nalog.cancelIncome(db, row.npd_receipt_uuid, 'REFUND')
      await db.query("UPDATE payments SET npd_status = 'canceled' WHERE id = $1", [row.id])
    } catch (e) {
      console.error(`[nalog-job] Отмена чека payment ${row.id} не удалась: ${e.message}`)
      await db.query('UPDATE payments SET npd_last_error = $1 WHERE id = $2', [e.message, row.id])
    }
  }

  // 2) Регистрация дохода по успешным платежам. Claim ≤ 2.
  const pendingRes = await db.query(
    `UPDATE payments SET npd_status = 'pending'
     WHERE npd_status = 'pending'
       AND id IN (SELECT id FROM payments WHERE npd_status = 'pending' ORDER BY created_at LIMIT 2)
     RETURNING id, user_id, amount, plan, created_at, npd_attempts,
               (SELECT email FROM users WHERE users.id = payments.user_id) AS email`
  )

  for (const row of pendingRes.rows) {
    try {
      const description = PLAN_DESC[row.plan] || PLAN_DESC.monthly
      const uuid = await nalog.addIncome(db, {
        name: description,
        amount: Number(row.amount),
        quantity: 1,
        operationTime: row.created_at
      })
      await db.query(
        `UPDATE payments SET npd_status = 'registered', npd_receipt_uuid = $1, npd_registered_at = NOW(), npd_last_error = NULL
         WHERE id = $2`,
        [uuid, row.id]
      )
      if (row.email) {
        await email.sendReceiptLink(row.email, nalog.getReceiptUrl(uuid), description, row.amount)
      }
    } catch (e) {
      const attempts = (row.npd_attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        await db.query(
          "UPDATE payments SET npd_status = 'failed', npd_attempts = $1, npd_last_error = $2 WHERE id = $3",
          [attempts, e.message, row.id]
        )
        console.error(`[nalog-job] Чек payment ${row.id} помечен failed после ${attempts} попыток: ${e.message}`)
        if (process.env.ADMIN_EMAIL) {
          await email.sendReceiptLink(process.env.ADMIN_EMAIL, '-', `СБОЙ регистрации чека payment ${row.id}: ${e.message}`, row.amount).catch(() => {})
        }
      } else {
        await db.query(
          'UPDATE payments SET npd_attempts = $1, npd_last_error = $2 WHERE id = $3',
          [attempts, e.message, row.id]
        )
        console.error(`[nalog-job] Регистрация чека payment ${row.id} не удалась (попытка ${attempts}): ${e.message}`)
      }
    }
  }
}

module.exports = { startNalogJob, runNalogReceipts }
```

> Примечание о claim: `UPDATE ... WHERE npd_status='pending' ... RETURNING` оставляет статус `pending`, но атомарно возвращает строки текущему прогону. При одиночном инстансе pm2 двойная обработка маловероятна; статус меняется на `registered`/`failed` по результату.

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/__tests__/nalogJob.test.js`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs/nalogJob.js backend/src/__tests__/nalogJob.test.js
git commit -m "feat(nalog): nalogJob — фоновая регистрация и отмена чеков с ретраями"
```

---

## Task 6: Пометка платежей в billing.js webhook

**Files:**
- Modify: `backend/src/routes/billing.js`
- Modify: `backend/src/__tests__/billing.test.js`

- [ ] **Step 1: Дописать падающие тесты в billing.test.js**

В `backend/src/__tests__/billing.test.js` расширь `makeMockDb`, добавив обработку новых SQL (вставь ветки перед финальным `throw new Error('Неожиданный SQL в моке: ' + sql)`):

```js
      if (sql.includes("SET npd_status = 'pending'")) {
        const p = s.payments[params[0]]
        if (p) p.npd_status = 'pending'
        return { rows: [] }
      }
      if (sql.includes("SET npd_status = 'cancel_pending'")) {
        const p = s.payments[params[0]]
        if (p) p.npd_status = 'cancel_pending'
        return { rows: [] }
      }
```

Также в ветке refund-SELECT добавь возврат `npd_receipt_uuid`. Замени строку:

```js
      if (sql.includes('SELECT user_id, plan, status FROM payments WHERE yk_payment_id')) {
        const p = s.payments[params[0]]
        return { rows: p ? [{ user_id: p.user_id, plan: p.plan, status: p.status }] : [] }
      }
```

на:

```js
      if (sql.includes('FROM payments WHERE yk_payment_id') && sql.includes('user_id') && sql.includes('npd_receipt_uuid')) {
        const p = s.payments[params[0]]
        return { rows: p ? [{ user_id: p.user_id, plan: p.plan, status: p.status, npd_receipt_uuid: p.npd_receipt_uuid || null }] : [] }
      }
```

Добавь новый describe-блок в конец файла:

```js
const nalogEnabled = {
  isEnabled: () => true,
  addIncome: async () => 'rcpt_x',
  cancelIncome: async () => ({}),
  getReceiptUrl: () => 'https://x/print'
}

describe('POST /billing/webhook — пометка чеков НПД', () => {
  it('payment.succeeded при включённом «Мой налог» → npd_status=pending', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db, { nalog: nalogEnabled })
    await supertest(app.server).post('/billing/webhook').send(succeededWebhook())
    expect(db.state.payments['pay_001'].npd_status).toBe('pending')
    await app.close()
  })

  it('«Мой налог» отключён → npd_status не выставляется', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db) // без opts.nalog → дефолтный сервис, isEnabled()=false (нет env)
    await supertest(app.server).post('/billing/webhook').send(succeededWebhook({ id: 'pay_no_npd' }))
    expect(db.state.payments['pay_no_npd'].npd_status).toBeUndefined()
    await app.close()
  })

  it('refund.succeeded с зарегистрированным чеком → npd_status=cancel_pending', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db, { nalog: nalogEnabled })
    await supertest(app.server).post('/billing/webhook').send(succeededWebhook())
    db.state.payments['pay_001'].npd_receipt_uuid = 'rcpt_x' // имитируем уже выданный чек
    await supertest(app.server).post('/billing/webhook').send(refundWebhook())
    expect(db.state.payments['pay_001'].npd_status).toBe('cancel_pending')
    await app.close()
  })
})
```

- [ ] **Step 2: Дать buildApp возможность инжектить опции в billing**

В `backend/src/__tests__/helpers/buildApp.js` измени сигнатуру и регистрацию billing.

Замени строку:

```js
async function buildApp(mockDb) {
```

на:

```js
async function buildApp(mockDb, billingOpts = {}) {
```

Замени строку:

```js
  fastify.register(require('../../routes/billing'),   { prefix: '/billing' })
```

на:

```js
  fastify.register(require('../../routes/billing'),   { prefix: '/billing', ...billingOpts })
```

Остальные вызовы `buildApp(db)` в существующих тестах не меняются (второй аргумент по умолчанию `{}`). Новые тесты Task 6 вызывают `buildApp(db, { nalog: nalogEnabled })`.

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npx vitest run src/__tests__/billing.test.js`
Expected: FAIL — новые тесты падают (роут ещё не пишет `npd_status`).

- [ ] **Step 4: Реализовать пометку в billing.js**

В `backend/src/routes/billing.js`:

(a) Подключить nalog-сервис рядом с инъекцией yookassa (после строки `const yk = (opts && opts.yookassa) || yookassa`):

```js
  const nalogService = require('../services/nalogService')
  const nalog = (opts && opts.nalog) || nalogService
```

(b) В ветке `payment.succeeded`, сразу после `INSERT INTO payments ... ON CONFLICT (yk_payment_id) DO UPDATE SET status = 'succeeded'` (перед `return reply.code(200).send({ ok: true })`), добавить:

```js
      // Поставить платёж в очередь на регистрацию чека НПД (если «Мой налог» подключён).
      if (nalog.isEnabled()) {
        await db.query(
          "UPDATE payments SET npd_status = 'pending' WHERE yk_payment_id = $1 AND npd_status IS NULL",
          [object.id]
        )
      }
```

(c) В ветке `refund.succeeded` расширить SELECT, добавив `npd_receipt_uuid`. Заменить:

```js
      const payRes = await db.query(
        'SELECT user_id, plan, status FROM payments WHERE yk_payment_id = $1', [refund.payment_id]
      )
```

на:

```js
      const payRes = await db.query(
        'SELECT user_id, plan, status, npd_receipt_uuid FROM payments WHERE yk_payment_id = $1', [refund.payment_id]
      )
```

И после `UPDATE payments SET status = 'refunded' WHERE yk_payment_id = $1` (перед `return`) добавить:

```js
      // Если по платежу был выдан чек НПД — поставить его на аннулирование.
      if (nalog.isEnabled() && pay.npd_receipt_uuid) {
        await db.query(
          "UPDATE payments SET npd_status = 'cancel_pending' WHERE yk_payment_id = $1",
          [refund.payment_id]
        )
      }
```

- [ ] **Step 5: Запустить весь файл — убедиться, что зелёный**

Run: `npx vitest run src/__tests__/billing.test.js`
Expected: PASS (старые + 3 новых теста).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/billing.js backend/src/__tests__/billing.test.js backend/src/__tests__/helpers/buildApp.js
git commit -m "feat(nalog): webhook помечает платежи к регистрации/аннулированию чека НПД"
```

---

## Task 7: Регистрация nalogJob в app.js

**Files:**
- Modify: `backend/src/app.js:108-116`

- [ ] **Step 1: Подключить и запустить джоб**

В `backend/src/app.js` в блоке background jobs добавь require и вызов:

```js
const { startWeatherJob } = require('./jobs/weatherJob')
const { startCareRemindersJob } = require('./jobs/careRemindersJob')
const { startRenewalJob } = require('./jobs/renewalJob')
const { startNalogJob } = require('./jobs/nalogJob')
app.addHook('onReady', async () => {
  startWeatherJob(app.db)
  startCareRemindersJob(app.db)
  startRenewalJob(app.db)
  startNalogJob(app.db)
})
```

- [ ] **Step 2: Прогнать весь набор тестов — регрессий нет**

Run: `npm test`
Expected: PASS (все файлы, включая новые nalog*).

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.js
git commit -m "feat(nalog): запуск nalogJob при старте сервера"
```

---

## Task 8: Bootstrap-скрипт авторизации (scripts/nalog-auth.js)

**Files:**
- Create: `backend/scripts/nalog-auth.js`

- [ ] **Step 1: Написать интерактивный скрипт**

Create `backend/scripts/nalog-auth.js`:

```js
'use strict'

// Одноразовая авторизация в «Мой налог» по номеру телефона + SMS.
// Сохраняет refresh_token в таблицу nalog_auth (id=1) и печатает сгенерированный device id.
// Запуск (из backend, с заполненным .env — нужен NALOG_PROXY_URL и доступ к БД):
//   node scripts/nalog-auth.js
//
// ВАЖНО: ходит к ФНС через RU-прокси (NALOG_PROXY_URL). Время на машине должно совпадать с реальным.

require('dotenv').config()
const readline = require('readline')
const crypto = require('crypto')
const fetch = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { Pool } = require('pg')

const API = process.env.NALOG_API || 'https://lknpd.nalog.ru/api/v1'

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()) }))
}

function agent() {
  if (!process.env.NALOG_PROXY_URL) throw new Error('NALOG_PROXY_URL не задан')
  return new HttpsProxyAgent(process.env.NALOG_PROXY_URL)
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
    agent: agent()
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(data)}`)
  return data
}

async function main() {
  const deviceId = process.env.NALOG_DEVICE_ID || crypto.randomBytes(11).toString('hex').slice(0, 21)
  const phone = process.env.NALOG_PHONE || await ask('Телефон (79XXXXXXXXX): ')

  const challenge = await post('/auth/challenge', { phone, requireTpToBeActive: true })
  console.log('SMS отправлено. challengeToken получен.')
  const code = await ask('Код из SMS: ')

  const deviceInfo = { appVersion: '1.0.0', sourceDeviceId: deviceId, sourceType: 'WEB', metaDetails: { userAgent: 'Mozilla/5.0' } }
  const auth = await post('/auth/challenge/verify', {
    phone,
    code,
    challengeToken: challenge.challengeToken,
    deviceInfo
  })
  if (!auth.refreshToken) throw new Error('refreshToken не получен: ' + JSON.stringify(auth))

  const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
  await pool.query(
    'UPDATE nalog_auth SET refresh_token = $1, inn = $2, updated_at = NOW() WHERE id = 1',
    [auth.refreshToken, (auth.profile && auth.profile.inn) || process.env.NALOG_INN || null]
  )
  await pool.end()

  console.log('\n✅ refresh_token сохранён в nalog_auth.')
  console.log(`Добавь в .env (если ещё нет): NALOG_DEVICE_ID=${deviceId}`)
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
```

> Примечание: точные пути `/auth/challenge` и `/auth/challenge/verify` — по неофициальному API ФНС; при изменении API формат уточняется по актуальной обёртке (`lknpd-nalog-api`). Скрипт интерактивный, в CI не запускается, тестами не покрывается.

- [ ] **Step 2: Проверить синтаксис (без вызова сети)**

Run: `node -e "require('./scripts/nalog-auth.js')" 2>&1 | findstr /v "Ошибка"` — допустимо, что скрипт запросит ввод; прерви Ctrl+C. Главное — нет SyntaxError при загрузке.
Альтернатива: `node --check scripts/nalog-auth.js`
Expected: команда `node --check` завершается без вывода (синтаксис валиден).

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/nalog-auth.js
git commit -m "feat(nalog): bootstrap-скрипт авторизации в «Мой налог» (телефон+SMS)"
```

---

## Task 9: Конфиг и документация

**Files:**
- Modify: `backend/.env.example`
- Modify: `docs/DEPLOY.md`

- [ ] **Step 1: Добавить env-переменные в .env.example**

В `backend/.env.example` после блока ЮKassa добавь:

```bash
# ── «Мой налог» (ФНС, НПД 422-ФЗ): авторегистрация дохода и чеков самозанятого ──────────────
# Сервис ЮKassa «Чеки для самозанятых» прекращён 29.12.2025 → регистрируем доход сами через
# неофициальный API lknpd.nalog.ru. Включается заданием NALOG_INN + NALOG_PROXY_URL и наличием
# refresh_token (получить одноразово: node scripts/nalog-auth.js). Без них nalogJob пропускается.
# ВАЖНО: ФНС режет не-РФ IP — запросы идут через российский forward-прокси (NALOG_PROXY_URL).
# ВАЖНО: на сервере должно быть точное время (NTP), иначе ФНС отклоняет запросы.
NALOG_INN=
NALOG_PHONE=
NALOG_PROXY_URL=
# Заполнится скриптом nalog-auth.js (стабильный id устройства):
NALOG_DEVICE_ID=
```

- [ ] **Step 2: Добавить раздел в DEPLOY.md**

В `docs/DEPLOY.md` добавь раздел:

```markdown
## «Мой налог» (чеки НПД)

Авторегистрация дохода в ФНС после прекращения сервиса ЮKassa «Чеки для самозанятых» (29.12.2025).

Требования на сервере:
- RU forward-прокси (ФНС режет не-РФ IP): задать `NALOG_PROXY_URL` в `.env`.
- Точное время (NTP): `timedatectl set-ntp true` — ФНС отклоняет запросы при расхождении часов.
- Миграция 040: `ssh hetzner 'sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/040_nalog_receipts.sql'`
  затем `ssh hetzner 'sudo -u postgres psql -d dacha_db -c "ALTER TABLE nalog_auth OWNER TO dacha_user;"'`

Одноразовая авторизация (телефон + SMS):
```
cd /var/www/dacha-api/backend && node scripts/nalog-auth.js
```
Сохранит refresh_token в `nalog_auth` и выведет `NALOG_DEVICE_ID` — добавить в `.env`, затем `pm2 restart dacha-api`.

Если регистрация чеков начала падать (письма-алерты на ADMIN_EMAIL, `npd_status='failed'`):
проверить доступность прокси и при необходимости переавторизоваться скриптом выше.
```

- [ ] **Step 3: Финальный прогон тестов**

Run (в `backend`): `npm test`
Expected: PASS — все тесты.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example docs/DEPLOY.md
git commit -m "docs(nalog): env-переменные и инструкция деплоя «Мой налог»"
```

---

## Итоговая проверка (после всех задач)

- [ ] `npm test` зелёный (все файлы).
- [ ] Линт/запуск: `node --check src/services/nalogService.js src/jobs/nalogJob.js`.
- [ ] Спека покрыта: nalogService (Task 2-3), очередь+миграция (Task 1), webhook (Task 6), воркер (Task 5), email (Task 4), bootstrap (Task 8), конфиг/деплой+NTP (Task 9).
- [ ] Вне scope (не делаем): бэкфилл, внешняя очередь, ротация прокси, несколько ИНН.

## Замечания по реальному API (для исполнителя)
- Точные пути авторизации (`/auth/challenge`, `/auth/challenge/verify`, `/auth/token`) и поля ответа
  (`token`, `tokenExpireIn`, `refreshToken`, `approvedReceiptUuid`) — по неофициальному API ФНС.
  Если ФНС изменит контракт, сверяться с актуальной обёрткой `lknpd-nalog-api` / `@shoman4eg/moy-nalog`.
- Все сетевые вызовы изолированы в `nalogService` и `scripts/nalog-auth.js` — зона правок при дрейфе API ограничена.
```
