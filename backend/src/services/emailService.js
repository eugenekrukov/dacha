'use strict'

const nodemailer = require('nodemailer')

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
      : undefined
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

async function sendMail(to, subject, text, html) {
  const transport = getTransport()
  if (!transport) {
    console.warn(`[email] письмо "${subject}" для ${to} не отправлено (SMTP отключён)`)
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

module.exports = {
  generateCode,
  sendMail,
  sendVerificationCode,
  sendPasswordResetCode,
  _resetTransport
}
