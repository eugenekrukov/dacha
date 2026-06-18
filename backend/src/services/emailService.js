'use strict'

const nodemailer = require('nodemailer')
const fetch = require('node-fetch')

// Транспорт создаётся лениво и кэшируется. Если SMTP_HOST не задан — почта отключена
// (как pushService при отсутствии токенов): функции логируют предупреждение и no-op,
// чтобы регистрация/сброс не падали в окружениях без SMTP (dev, тесты).
let cachedTransport
let triedTransport = false

function getTransport() {
  if (triedTransport) return cachedTransport
  triedTransport = true

  const host = process.env.SMTP_HOST
  if (!host) {
    console.warn('[email] SMTP_HOST не задан — отправка писем отключена')
    cachedTransport = null
    return null
  }

  const port = parseInt(process.env.SMTP_PORT) || 587
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    // 465 — implicit TLS; иначе STARTTLS. Можно форсировать через SMTP_SECURE=true.
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Жёсткие таймауты: если порт/SMTP недоступен (напр. хостинг режет исходящий SMTP) —
    // быстрый отказ вместо зависания запроса на минуты.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 12000
  })
  return cachedTransport
}

// Только для тестов — сбросить кэш транспорта после смены env.
function _resetTransport() {
  cachedTransport = undefined
  triedTransport = false
}

/** Генерирует 6-значный код подтверждения (строка, ведущие нули сохраняются). */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const APP_NAME = () => process.env.APP_NAME || 'Календарь дачника'
const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@dacha.local'

// Unisender Go — отправка через HTTP API (порт 443), обходит блокировку исходящего SMTP
// на хостинге (Hetzner режет 25/465/587). Включается заданием UNISENDER_GO_API_KEY.
const UNISENDER_HOST = () => process.env.UNISENDER_GO_HOST || 'go1.unisender.ru'

async function sendViaUnisender(to, subject, text, html) {
  const apiKey = process.env.UNISENDER_GO_API_KEY
  const url = `https://${UNISENDER_HOST()}/ru/transactional/api/v1/email/send.json`
  const payload = {
    message: {
      recipients: [{ email: to }],
      subject,
      from_email: FROM(),
      from_name: APP_NAME(),
      body: { html, plaintext: text },
      // Транзакционное письмо (код подтверждения) — без ссылки отписки.
      // Требует включённой опции транзакционных писем в аккаунте Unisender Go.
      skip_unsubscribe: 1
    }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.status === 'error') {
      console.error(`[email] Unisender ошибка (${res.status}): ${JSON.stringify(data)}`)
      return false
    }
    if (Array.isArray(data.failed_emails) && data.failed_emails.length > 0) {
      console.error(`[email] Unisender не доставлено: ${data.failed_emails.join(', ')}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[email] Unisender сетевая ошибка:', e.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

// Brevo (ex-Sendinblue) — транзакционная почта по HTTP API (порт 443). Подтверждение
// домена через CNAME/TXT (не NS), бесплатный тариф. Включается заданием BREVO_API_KEY.
async function sendViaBrevo(to, subject, text, html) {
  const apiKey = process.env.BREVO_API_KEY
  const payload = {
    sender: { name: APP_NAME(), email: FROM() },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (res.ok) return true  // 201 Created
    const data = await res.text().catch(() => '')
    console.error(`[email] Brevo ошибка (${res.status}): ${data}`)
    return false
  } catch (e) {
    console.error('[email] Brevo сетевая ошибка:', e.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function sendMail(to, subject, text, html) {
  // Приоритет: Brevo → Unisender Go → SMTP → отключено.
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(to, subject, text, html)
  }
  if (process.env.UNISENDER_GO_API_KEY) {
    return sendViaUnisender(to, subject, text, html)
  }
  const transport = getTransport()
  if (!transport) {
    console.warn(`[email] письмо "${subject}" для ${to} не отправлено (почта отключена)`)
    return false
  }
  try {
    await transport.sendMail({ from: `"${APP_NAME()}" <${FROM()}>`, to, subject, text, html })
    return true
  } catch (e) {
    console.error('[email] ошибка отправки:', e.message)
    return false
  }
}

function codeHtml(intro, code) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#FF7B00">${APP_NAME()}</h2>
    <p>${intro}</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
    <p style="color:#888;font-size:13px">Код действует 15 минут. Если вы не запрашивали его — просто игнорируйте это письмо.</p>
  </div>`
}

async function sendVerificationCode(to, code) {
  return sendMail(
    to,
    `Код подтверждения — ${APP_NAME()}`,
    `Ваш код подтверждения email: ${code}\nКод действует 15 минут.`,
    codeHtml('Подтвердите адрес электронной почты. Введите этот код в приложении:', code)
  )
}

async function sendPasswordResetCode(to, code) {
  return sendMail(
    to,
    `Сброс пароля — ${APP_NAME()}`,
    `Ваш код для сброса пароля: ${code}\nКод действует 15 минут.`,
    codeHtml('Вы запросили сброс пароля. Введите этот код в приложении:', code)
  )
}

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

module.exports = {
  generateCode,
  sendMail,
  sendReceiptLink,
  sendVerificationCode,
  sendPasswordResetCode,
  _resetTransport
}
