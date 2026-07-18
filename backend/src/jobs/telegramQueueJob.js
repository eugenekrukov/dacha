'use strict'

// Агент-автопостер Telegram: фоновый джоб публикует «созревшие» посты из той же очереди, что
// наполняется для ВК (vk_post_queue, backend/scripts/vk-queue.js load <file>), в Telegram-канал.
// Статус независим от `status` (ВК) — колонки telegram_* (миграция 058). Движок постинга —
// services/telegramService.js. Включается заданием TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID.

const cron = require('node-cron')
const telegramService = require('../services/telegramService')
const { queueMessage } = require('../services/vkContent')

const MAX_ATTEMPTS = 3
const BATCH = 2 // постов за прогон — мягко к лимитам Bot API

// Фолбэк для «читать полностью», если пост ещё не опубликован в ВК (vk_post_url пуст) — редкий
// краевой случай, обе очереди читают одно и то же расписание, но порядок прогона не гарантирован.
const fallbackContinueUrl = (env) => env.TELEGRAM_POST_LINK || 'https://dacha.studio1008.com'

function isEnabled(env = process.env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHANNEL_ID)
}

// deps инъектируются в тестах.
async function runTelegramQueue(db, { tg: tgSvc = telegramService, env = process.env } = {}) {
  if (!isEnabled(env)) {
    console.log('[telegram-queue] отключён (нет TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)')
    return { posted: 0, failed: 0 }
  }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHANNEL_ID: channelId } = env

  // Тот же расчёт на один инстанс pm2, что и у vkQueueJob (см. его комментарий) — строки не
  // клеймятся FOR UPDATE SKIP LOCKED, sendMessage/sendPhoto не идемпотентны.
  const due = await db.query(
    `SELECT id, body, tags, image_url, vk_post_url, telegram_attempts
       FROM vk_post_queue
      WHERE telegram_status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at
      LIMIT ${BATCH}`
  )
  if (due.rows.length === 0) return { posted: 0, failed: 0 }

  let posted = 0
  let failed = 0
  for (const row of due.rows) {
    try {
      const continueUrl = row.vk_post_url || fallbackContinueUrl(env)
      const body = queueMessage({ body: row.body, tags: row.tags })
      const { messageId } = await tgSvc.sendPost({ token, channelId, body, continueUrl, photoUrl: row.image_url || undefined })
      const url = tgSvc.postUrl(channelId, messageId)
      await db.query(
        "UPDATE vk_post_queue SET telegram_status='posted', telegram_post_url=$1, telegram_posted_at=NOW(), telegram_error=NULL WHERE id=$2",
        [url, row.id]
      )
      posted++
      console.log(`[telegram-queue] опубликовано #${row.id}: ${url}`)
    } catch (e) {
      const attempts = (row.telegram_attempts || 0) + 1
      const isFailed = attempts >= MAX_ATTEMPTS
      await db.query(
        'UPDATE vk_post_queue SET telegram_attempts=$1, telegram_error=$2, telegram_status=$3 WHERE id=$4',
        [attempts, e.message, isFailed ? 'failed' : 'pending', row.id]
      )
      if (isFailed) failed++
      console.error(`[telegram-queue] #${row.id} ${isFailed ? 'failed' : 'retry'} (попытка ${attempts}): ${e.message}`)
    }
  }
  return { posted, failed }
}

function startTelegramQueueJob(db) {
  if (!isEnabled()) { console.log('[telegram-queue] автопостер Telegram отключён (нет env)'); return }
  cron.schedule('*/10 * * * *', () => {
    runTelegramQueue(db).catch((e) => console.error('[telegram-queue]', e.message))
  })
  console.log('[telegram-queue] автопостер Telegram запущен: проверка очереди каждые 10 минут')
}

module.exports = { startTelegramQueueJob, runTelegramQueue, isEnabled }
