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

// ─── Жизненный цикл триала (письма по дню) ───────────────────────────────────

const APP_URL = () => process.env.APP_URL || 'https://dacha.studio1008.com/app/'

/** Брендированная обёртка письма с кнопкой-CTA. */
function lifecycleHtml(heading, bodyHtml, ctaLabel, ctaUrl) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#2D1500">
    <h2 style="color:#FF7B00;margin:0 0 12px">${APP_NAME()}</h2>
    <h3 style="margin:0 0 12px">${heading}</h3>
    <div style="font-size:15px;line-height:1.5">${bodyHtml}</div>
    <p style="margin:24px 0">
      <a href="${ctaUrl}" style="background:#FF7B00;color:#fff;text-decoration:none;
         padding:12px 22px;border-radius:12px;font-weight:bold;display:inline-block">${ctaLabel}</a>
    </p>
    <p style="color:#888;font-size:12px">Вы получаете это письмо, потому что зарегистрировались в «${APP_NAME()}».
      Мы в <a href="https://vk.ru/calendacha" style="color:#888">ВКонтакте</a>,
      <a href="https://t.me/calendacha" style="color:#888">Telegram</a>,
      <a href="https://dzen.ru/calendacha" style="color:#888">Дзене</a> и
      <a href="https://ok.ru/group/70000052629058" style="color:#888">Одноклассниках</a>.</p>
  </div>`
}

/**
 * Контент письма по дню триала. stats = { plantings, actions } (для дней 5/6).
 * Возвращает { subject, text, html } либо null, если для дня письма нет.
 */
// Обращение в начале письма. С именем: «Иван, рады…» (первое слово строчное);
// без имени (клиент имя не собирает → почти всегда): «Рады…» (с заглавной).
// `sentence` ВСЕГДА передаём с заглавной буквы.
function greet(name, sentence) {
  if (!name) return sentence
  return `${name}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`
}

function trialEmailContent(day, name, stats = {}, opts = {}) {
  const url = APP_URL()
  const cta = 'Открыть приложение'
  const hasGarden = !!opts.hasGarden
  switch (day) {
    case 1:
      // Ветвление по участку: новичку — «создайте участок», уже заведшему — «загляните сегодня».
      return hasGarden
        ? {
            subject: `Рады, что вы начали 🌱`,
            text: `${greet(name, 'Вы уже завели участок — отлично!')} Заглядывайте каждый день: приложение подскажет, что сделать сегодня, и напомнит о поливе и подкормке.`,
            html: lifecycleHtml(
              'Ваш участок уже с вами 🌱',
              `<p>${greet(name, 'Вы уже завели участок — отлично!')}</p>
               <p>Заглядывайте каждый день: «${APP_NAME()}» подскажет, что сделать сегодня,
               и напомнит о поливе, подкормке и сроках — с учётом погоды и вашего региона.</p>`,
              cta, url
            )
          }
        : {
            subject: `Добро пожаловать в ${APP_NAME()} 🌱`,
            text: `${greet(name, 'Рады видеть вас!')} Создайте участок и добавьте первую культуру — и приложение будет само подсказывать, что делать на грядках именно сегодня.`,
            html: lifecycleHtml(
              'С чего начать 🌱',
              `<p>${greet(name, 'Рады видеть вас!')}</p>
               <p>Добавьте свой участок и первую культуру — и «${APP_NAME()}» будет сам подсказывать,
               что делать сегодня: полив, подкормку, сроки посадки, с учётом погоды и вашего региона.</p>`,
              'Создать участок', url
            )
          }
    case 3:
      return {
        subject: 'Справочник проблем растений — под рукой',
        text: `${greet(name, 'Пожелтел лист или появились пятна?')} В приложении есть справочник болезней, вредителей и дефицитов с фото и подсказками по лечению.`,
        html: lifecycleHtml(
          'Что-то не так с растением? 🔎',
          `<p>${greet(name, 'Пожелтел лист, пятна или вредитель?')}</p>
           <p>В «${APP_NAME()}» есть справочник болезней, вредителей и дефицитов микроэлементов —
           с фото, симптомами и понятными подсказками, что делать.</p>`,
          'Открыть справочник', url
        )
      }
    case 5:
      // Если активности нет (0 посадок) — не показываем «0/0», а зовём начать сезон.
      return (stats.plantings || 0) > 0
        ? {
            subject: 'Ваш сезон в цифрах 🌿',
            text: `${greet(name, 'За время в приложении вы уже добавили посадок:')} ${stats.plantings || 0}, записали действий: ${stats.actions || 0}. Так держать!`,
            html: lifecycleHtml(
              'Ваш сезон в цифрах 🌿',
              `<p>${greet(name, 'Вот что вы уже сделали в приложении:')}</p>
               <ul style="font-size:16px">
                 <li>Посадок добавлено: <b>${stats.plantings || 0}</b></li>
                 <li>Действий записано: <b>${stats.actions || 0}</b></li>
               </ul>
               <p>Весь ваш сезон — в одном месте. Не теряйте набранный темп.</p>`,
              cta, url
            )
          }
        : {
            subject: 'Начните свой сезон 🌿',
            text: `${greet(name, 'Ваш участок ещё пустой.')} Добавьте первую культуру — и приложение начнёт вести ваш сезон: подскажет сроки, полив и подкормку.`,
            html: lifecycleHtml(
              'Начните свой сезон 🌿',
              `<p>${greet(name, hasGarden ? 'Ваш участок ещё пустой.' : 'Вы ещё не начали вести участок.')}</p>
               <p>Добавьте первую культуру — и «${APP_NAME()}» начнёт вести ваш сезон:
               подскажет сроки посадки, напомнит о поливе и подкормке.</p>`,
              hasGarden ? 'Добавить культуру' : 'Создать участок', url
            )
          }
    case 6:
      return {
        subject: 'Чем «Дачник Про» усилит ваш сезон',
        text: `${greet(name, 'Бесплатно вам доступно 3 посадки одновременно.')} С «Дачник Про» — без ограничения на число посадок, плюс грядки с подсказкой севооборота и сравнение урожая по сезонам.`,
        html: lifecycleHtml(
          'Чем «Дачник Про» усилит ваш сезон 🌿',
          `<p>${greet(name, 'Бесплатно в приложении доступны 1 участок и до 3 посадок одновременно — без ограничения по времени.')}</p>
           <p>С «Дачник Про» — без ограничения на число посадок, планирование грядок с подсказкой
           севооборота, сравнение урожая по сезонам и экспорт истории.</p>`,
          'Оформить «Дачник Про»', url
        )
      }
    case 8:
      return {
        subject: 'Возвращайтесь на грядки 🌻',
        text: `${greet(name, 'Ваши посадки скучают!')} Загляните в приложение — сезон продолжается, а с «Дачник Про» посадок можно вести сколько угодно.`,
        html: lifecycleHtml(
          'Ваши грядки скучают 🌻',
          `<p>${greet(name, 'Давно не заглядывали — а сезон в разгаре.')}</p>
           <p>Бесплатный доступ никуда не делся: заходите и ведите свои посадки. А если тесно
           в лимите 3 посадок — «Дачник Про» снимает ограничение и добавляет планирование грядок
           и дневник урожая по сезонам.</p>`,
          'Вернуться к посадкам', url
        )
      }
    default:
      return null
  }
}

/** Отправляет письмо жизненного цикла триала за день `day`. Возвращает true при успехе. */
async function sendTrialEmail(to, name, day, stats, opts = {}) {
  const c = trialEmailContent(day, name, stats, opts)
  if (!c) return false
  let { text, html } = c
  // Ссылка отписки (one-click) — обязательна для информационных писем. Инжектим в футер.
  if (opts.unsubscribeUrl) {
    const link = `<p style="color:#888;font-size:12px"><a href="${opts.unsubscribeUrl}" style="color:#888">Отписаться от информационных писем</a></p>`
    html = html.replace(/<\/div>\s*$/, `${link}\n  </div>`)
    text = `${text}\n\nОтписаться от информационных писем: ${opts.unsubscribeUrl}`
  }
  return sendMail(to, c.subject, text, html)
}

// ─── Жизненный цикл ПЛАТНОЙ подписки (напоминания об окончании) ─────────────

/**
 * Письма по смещению (в днях) от `subscription_until`: отрицательное — заранее,
 * положительное — после окончания. Обезличенные (без имени) — см. правку владельца.
 */
function subscriptionEmailContent(offset) {
  const url = APP_URL()
  const cta = 'Продлить «Дачник Про»'
  switch (offset) {
    case -3:
      return {
        subject: 'Подписка заканчивается через 3 дня',
        text: 'Через 3 дня закончится оплаченный период «Дачник Про». Продлите подписку, чтобы не потерять напоминания о поливе и подкормке, календарь работ, дневник урожая и историю посадок — без рекламы.',
        html: lifecycleHtml(
          'Подписка заканчивается через 3 дня ⏳',
          `<p>Через 3 дня закончится оплаченный период «Дачник Про».</p>
           <p>Продлите подписку, чтобы не потерять напоминания о поливе и подкормке,
           календарь работ, дневник урожая и историю посадок — без рекламы.</p>`,
          cta, url
        )
      }
    case 0:
      return {
        subject: 'Подписка заканчивается сегодня',
        text: 'Сегодня заканчивается оплаченный период «Дачник Про». Продлите подписку, чтобы без перерыва получать напоминания о поливе и подкормке, календарь работ и дневник урожая.',
        html: lifecycleHtml(
          'Подписка заканчивается сегодня ⏳',
          `<p>Сегодня заканчивается оплаченный период «Дачник Про».</p>
           <p>Продлите подписку, чтобы без перерыва получать напоминания о поливе и подкормке,
           календарь работ и дневник урожая.</p>`,
          cta, url
        )
      }
    case 3:
      return {
        subject: 'Доступ к «Дачник Про» приостановлен',
        text: 'Оплаченный период закончился, и напоминания о поливе, подкормке и календарь работ сейчас не приходят. Продлите подписку — доступ вернётся сразу.',
        html: lifecycleHtml(
          'Доступ приостановлен',
          `<p>Оплаченный период закончился, и напоминания о поливе, подкормке
           и календарь работ сейчас не приходят.</p>
           <p>Продлите подписку — доступ вернётся сразу.</p>`,
          cta, url
        )
      }
    case 30:
      return {
        subject: 'Сезон продолжается — а напоминаний нет',
        text: 'Уже месяц без подписки «Дачник Про» — а сезон не ждёт: полив, подкормка, сроки сбора урожая легко пропустить без напоминаний. Продлите подписку — и приложение снова возьмёт сезон под контроль.',
        html: lifecycleHtml(
          'Грядки не дождались 🌻',
          `<p>Уже месяц без подписки «Дачник Про» — а сезон не ждёт: полив, подкормка,
           сроки сбора урожая легко пропустить без напоминаний.</p>
           <p>Продлите подписку — и приложение снова возьмёт сезон под контроль.</p>`,
          cta, url
        )
      }
    default:
      return null
  }
}

/** Отправляет письмо жизненного цикла подписки за смещение `offset`. true при успехе. */
async function sendSubscriptionEmail(to, offset, opts = {}) {
  const c = subscriptionEmailContent(offset)
  if (!c) return false
  let { text, html } = c
  if (opts.unsubscribeUrl) {
    const link = `<p style="color:#888;font-size:12px"><a href="${opts.unsubscribeUrl}" style="color:#888">Отписаться от информационных писем</a></p>`
    html = html.replace(/<\/div>\s*$/, `${link}\n  </div>`)
    text = `${text}\n\nОтписаться от информационных писем: ${opts.unsubscribeUrl}`
  }
  return sendMail(to, c.subject, text, html)
}

/**
 * ЗАГОТОВКА НА БУДУЩЕЕ — нигде не вызывается и не подключена к джобам.
 * ЮKassa не разрешает рекуррентные платежи самозанятым, поэтому auto_renew=true сейчас
 * не возникает в продакшене (см. billing.js). Если это изменится (смена налогового режима/
 * исполнителя) — письмо за 3 дня до автосписания уже готово, останется подключить.
 */
function autoRenewReminderContent(amount, periodLabel) {
  return {
    subject: 'Подписка продлится автоматически через 3 дня',
    text: `Через 3 дня автоматически продлится подписка «Дачник Про» — с привязанной карты будет списано ${amount} ₽ за ${periodLabel}. Если хотите отключить автопродление, сделайте это в настройках до списания.`,
    html: lifecycleHtml(
      'Автопродление через 3 дня 🔄',
      `<p>Через 3 дня автоматически продлится подписка «Дачник Про» — с привязанной карты
       будет списано ${amount} ₽ за ${periodLabel}.</p>
       <p>Если хотите отключить автопродление, сделайте это в настройках до списания.</p>`,
      'Открыть настройки подписки', APP_URL()
    )
  }
}

module.exports = {
  generateCode,
  sendMail,
  sendReceiptLink,
  sendVerificationCode,
  sendPasswordResetCode,
  trialEmailContent,
  sendTrialEmail,
  subscriptionEmailContent,
  sendSubscriptionEmail,
  autoRenewReminderContent,
  _resetTransport
}
