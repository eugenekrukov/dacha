'use strict'

// Раз в неделю — короткий пост со ссылкой на лендинг (единственное место, где эта ссылка вообще
// появляется в Telegram-канале, см. telegramQueueJob.js). Фиксированный текст: содержимое очереди
// уже само по себе полезный контент, тут — просто редкое напоминание, что есть приложение.
// Включается тем же env, что и telegramQueueJob (TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID).

const cron = require('node-cron')
const telegramService = require('../services/telegramService')

const PROMO_TEXT = 'Персональные напоминания: когда поливать, подкармливать и что делать на грядках ' +
  '— под ваш регион и культуры. Попробуйте «Календарь дачника» бесплатно 7 дней: https://dacha.studio1008.com 🌻'

function isEnabled(env = process.env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID)
}

// deps инъектируются в тестах.
async function runWeeklyPromo({ tg: tgSvc = telegramService, env = process.env } = {}) {
  if (!isEnabled(env)) {
    console.log('[telegram-promo] отключён (нет TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)')
    return { posted: false }
  }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHANNEL_ID: channelId } = env
  const { messageId } = await tgSvc.sendPost({ token, channelId, body: PROMO_TEXT })
  const url = tgSvc.postUrl(channelId, messageId)
  console.log(`[telegram-promo] опубликовано: ${url}`)
  return { posted: true, url }
}

function startTelegramWeeklyPromoJob() {
  if (!isEnabled()) { console.log('[telegram-promo] еженедельный промо-пост отключён (нет env)'); return }
  // Понедельник 10:00 МСК — сервер в UTC, поэтому таймзона задана явно.
  cron.schedule('0 10 * * 1', () => {
    runWeeklyPromo().catch((e) => console.error('[telegram-promo]', e.message))
  }, { timezone: 'Europe/Moscow' })
  console.log('[telegram-promo] еженедельный промо-пост запущен: по понедельникам в 10:00 МСК')
}

module.exports = { startTelegramWeeklyPromoJob, runWeeklyPromo, isEnabled, PROMO_TEXT }
