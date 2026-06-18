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
