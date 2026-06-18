'use strict'

const crypto = require('crypto')
const fetch = require('node-fetch')

// Интеграция с ЮKassa (YooKassa) — приём прямых платежей картой + рекуррент.
// Включается заданием YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY. Без них биллинг отключён
// (как pushService/emailService): функции no-op/throw осознанно, роуты отвечают 503,
// чтобы dev/тесты работали без реальных ключей.
//
// Схема рекуррента: (1) первый платёж с save_payment_method=true → в объекте payment приходит
// payment_method.id; (2) автосписания — POST /v3/payments с payment_method_id, без confirmation;
// (3) подтверждение — вебхук payment.succeeded; (4) фискализация (54-ФЗ) — объект receipt,
// нужен ТОЛЬКО при подключённой онлайн-кассе (см. ниже; для самозанятого receipt отключаем).

const API_BASE = () => process.env.YOOKASSA_API || 'https://api.yookassa.ru/v3'
const RETURN_URL = () => process.env.YOOKASSA_RETURN_URL || 'https://dacha.studio1008.com/billing/return'
const APP_NAME = () => process.env.APP_NAME || 'Календарь дачника'

// Тарифы. amount — строка с двумя знаками (требование ЮKassa). days — срок доступа.
const PLANS = {
  monthly: { amount: '299.00',  days: 30,  description: 'Подписка «Календарь дачника» — 1 месяц' },
  yearly:  { amount: '1990.00', days: 365, description: 'Подписка «Календарь дачника» — 1 год' }
}

function isEnabled() {
  return !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY)
}

function getPlan(plan) {
  return PLANS[plan] || null
}

function authHeader() {
  const token = Buffer
    .from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`)
    .toString('base64')
  return `Basic ${token}`
}

// Чек. Режим — env YOOKASSA_RECEIPT_MODE (по умолчанию 'on'):
//   'on'  — передаём объект receipt с email покупателя и позицией услуги. ЮKassa фискализирует его,
//       ТОЛЬКО если у магазина подключена фискализация (онлайн-касса, 54-ФЗ). Без фискализации
//       ЮKassa отклоняет запрос с receipt → платёж не создаётся. vat_code=1 = «НДС не облагается».
//   'off' — receipt НЕ передаём, платёж проходит без фискализации.
//       ⚠️ тогда ЮKassa не получит email покупателя из платежа (берём его из таблицы users).
//
// ⚠️ ВАЖНО для САМОЗАНЯТОГО (с 29.12.2025): сервис ЮKassa «Чеки для самозанятых» (авто-регистрация
// дохода в ФНС и формирование чека НПД через «Мой налог») ПРЕКРАЩЁН и не возобновляется. Теперь
// самозанятый сам регистрирует доход и отправляет чек НПД покупателю в приложении «Мой налог»;
// приём денег через ЮKassa — без изменений. Поэтому для НПД-магазина ставим YOOKASSA_RECEIPT_MODE=off
// (иначе при отсутствии онлайн-кассы платежи будут падать). Самозанятые освобождены от ККТ (54-ФЗ);
// их чек — НПД по 422-ФЗ.
function receiptEnabled() {
  return (process.env.YOOKASSA_RECEIPT_MODE || 'on') !== 'off'
}

// Рекуррент (сохранение карты для автосписаний) требует включения «Автоплатежей» у магазина ЮKassa.
// Для самозанятых обычно НЕдоступно (ЮKassa: "This store can't make recurring payments"). По умолчанию
// off → разовая оплата, продление вручную. Включить, только если менеджер ЮMoney активировал автоплатежи.
function recurringEnabled() {
  return process.env.YOOKASSA_RECURRING === 'on'
}

function buildReceipt(email, planCfg) {
  if (!receiptEnabled()) return null
  return {
    customer: { email },
    items: [{
      description: planCfg.description.slice(0, 128),
      quantity: '1.00',
      amount: { value: planCfg.amount, currency: 'RUB' },
      vat_code: 1,            // 1 = НДС не облагается (самозанятый / НПД — без НДС)
      payment_subject: 'service',
      payment_mode: 'full_payment'
    }]
  }
}

// Низкоуровневый POST к ЮKassa с Basic-auth, обязательным Idempotence-Key и таймаутом.
async function ykPost(path, body, idempotenceKey) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${API_BASE()}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Idempotence-Key': idempotenceKey || crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data && (data.description || data.code) ? `${data.code || ''} ${data.description || ''}`.trim() : `HTTP ${res.status}`
      throw new Error(`ЮKassa ${path}: ${msg}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

async function ykGet(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${API_BASE()}${path}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader() },
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`ЮKassa GET ${path}: HTTP ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Первичный платёж: пользователь подтверждает оплату на стороне ЮKassa (redirect),
 * карта сохраняется для будущих автосписаний. Возвращает { id, confirmation_url, status }.
 */
async function createPayment(user, plan) {
  const planCfg = getPlan(plan)
  if (!planCfg) throw new Error(`Неизвестный тариф: ${plan}`)
  const receipt = buildReceipt(user.email, planCfg)
  const body = {
    amount: { value: planCfg.amount, currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: RETURN_URL() },
    description: planCfg.description,
    metadata: { user_id: String(user.id), plan },
    ...(receipt ? { receipt } : {})
  }
  // Сохраняем карту для автосписаний только если у магазина включён рекуррент (иначе ЮKassa отклонит).
  if (recurringEnabled()) body.save_payment_method = true
  const payment = await ykPost('/payments', body)
  return {
    id: payment.id,
    status: payment.status,
    confirmation_url: payment.confirmation && payment.confirmation.confirmation_url
  }
}

/**
 * Автосписание по сохранённой карте (без участия пользователя). Вызывается renewalJob.
 * Возвращает { id, status }.
 */
async function chargeRecurring(user, plan) {
  const planCfg = getPlan(plan)
  if (!planCfg) throw new Error(`Неизвестный тариф: ${plan}`)
  if (!user.payment_method_id) throw new Error('Нет сохранённой карты для автосписания')
  const receipt = buildReceipt(user.email, planCfg)
  const payment = await ykPost('/payments', {
    amount: { value: planCfg.amount, currency: 'RUB' },
    capture: true,
    payment_method_id: user.payment_method_id,
    description: planCfg.description,
    metadata: { user_id: String(user.id), plan, recurring: '1' },
    ...(receipt ? { receipt } : {})
  })
  return { id: payment.id, status: payment.status }
}

/** Авторитетное состояние платежа (для верификации вебхука — доверяем API, не телу запроса). */
async function getPayment(paymentId) {
  return ykGet(`/payments/${paymentId}`)
}

/**
 * Авторитетное состояние возврата (для верификации refund-вебхука — доверяем API, не телу).
 * Возвращает объект возврата ЮKassa, в т.ч. payment_id исходного платежа и status.
 */
async function getRefund(refundId) {
  return ykGet(`/refunds/${refundId}`)
}

module.exports = {
  PLANS, isEnabled, getPlan, buildReceipt,
  createPayment, chargeRecurring, getPayment, getRefund
}
