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
    // НПД-чек физлицу: ФНС принимает CASH для самозанятого (оплата картой проходит через ЮKassa отдельно).
    paymentType: 'CASH',
    ignoreMaxTotalIncomeRestriction: false,
    client: { contactPhone: null, displayName: null, incomeType: 'FROM_INDIVIDUAL', inn: null },
    requestTime: toMoscowISO(now),
    operationTime: toMoscowISO(op),
    services: [{ name, amount, quantity }],
    totalAmount: (amount * quantity).toFixed(2)
  }
}

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
// Допущение: один инстанс (pm2). При нескольких воркерах одновременный рефреш может затереть
// refresh_token друг друга — тогда нужен внешний лок/общий кэш токена.
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

// Допустимые причины аннулирования. ФНС /cancel принимает только эти строки в поле comment.
const CANCEL_COMMENTS = {
  CANCEL: 'Чек сформирован ошибочно',
  REFUND: 'Возврат средств'
}

// Аннулирует чек. reason: 'CANCEL' (ошибочный) | 'REFUND' (возврат).
async function cancelIncome(db, receiptUuid, reason, fetchImpl = fetch) {
  const comment = CANCEL_COMMENTS[reason]
  if (!comment) throw new Error(`Неизвестная причина аннулирования: ${reason}`)
  const now = toMoscowISO(new Date())
  const body = {
    receiptUuid,
    comment,
    operationTime: now,
    requestTime: now,
    partnerCode: null
  }
  return callWithAuth(db, fetchImpl, (token) => npdPost('/cancel', body, token, fetchImpl))
}

module.exports = {
  toMoscowISO, buildIncomeBody, API_BASE,
  isEnabled, getReceiptUrl, addIncome, cancelIncome, getAccessToken, _resetToken
}
