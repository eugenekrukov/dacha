'use strict'

// Агент-автопостер ВК: фоновый джоб публикует «созревшие» посты из очереди (vk_post_queue)
// по расписанию. Очередь наполняется заранее через CLI scripts/vk-queue.js load <file>.
// Движок постинга — services/vkService.js. Включается заданием VK_GROUP_ID + VK_ACCESS_TOKEN.

const cron = require('node-cron')
const vkService = require('../services/vkService')
const { queueMessage } = require('../services/vkContent')

const MAX_ATTEMPTS = 3
const BATCH = 2 // постов за прогон — мягко к лимитам ВК

const defaultLink = (env) => env.VK_POST_LINK || 'https://dacha.studio1008.com'

function isEnabled(env = process.env) {
  return !!(env.VK_GROUP_ID && env.VK_ACCESS_TOKEN)
}

// deps инъектируются в тестах.
async function runVkQueue(db, { vk: vkSvc = vkService, fetchImpl = fetch, env = process.env } = {}) {
  if (!isEnabled(env)) {
    console.log('[vk-queue] отключён (нет VK_GROUP_ID / VK_ACCESS_TOKEN)')
    return { posted: 0, failed: 0 }
  }
  const { VK_GROUP_ID: groupId, VK_ACCESS_TOKEN: token } = env

  // Расчёт на один инстанс pm2 и непересекающийся cron (то же допущение, что в nalogJob): строки
  // не клеймятся через FOR UPDATE SKIP LOCKED, поэтому параллельные прогоны теоретически могут взять
  // одну строку. wall.post не идемпотентен — при реальной многопоточности добавить claim-статус.
  const due = await db.query(
    `SELECT id, body, tags, image_url, link, attempts
       FROM vk_post_queue
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at
      LIMIT ${BATCH}`
  )
  if (due.rows.length === 0) return { posted: 0, failed: 0 }

  const vk = vkSvc.createVk({ token, fetchImpl })
  let posted = 0
  let failed = 0
  for (const row of due.rows) {
    try {
      let photo = null
      if (row.image_url) {
        photo = await vkSvc.uploadWallPhoto(vk, groupId, await vkSvc.loadImageBytes(row.image_url, fetchImpl))
      }
      const message = queueMessage({ body: row.body, tags: row.tags })
      const postId = await vkSvc.postToWall(vk, {
        groupId, message, photo, link: row.link || defaultLink(env)
      })
      const url = vkSvc.postUrl(groupId, postId)
      await db.query(
        "UPDATE vk_post_queue SET status='posted', vk_post_url=$1, posted_at=NOW(), error=NULL WHERE id=$2",
        [url, row.id]
      )
      posted++
      console.log(`[vk-queue] опубликовано #${row.id}: ${url}`)
    } catch (e) {
      const attempts = (row.attempts || 0) + 1
      const isFailed = attempts >= MAX_ATTEMPTS
      await db.query(
        'UPDATE vk_post_queue SET attempts=$1, error=$2, status=$3 WHERE id=$4',
        [attempts, e.message, isFailed ? 'failed' : 'pending', row.id]
      )
      if (isFailed) failed++
      console.error(`[vk-queue] #${row.id} ${isFailed ? 'failed' : 'retry'} (попытка ${attempts}): ${e.message}`)
    }
  }
  return { posted, failed }
}

function startVkQueueJob(db) {
  if (!isEnabled()) { console.log('[vk-queue] автопостер ВК отключён (нет env)'); return }
  cron.schedule('*/10 * * * *', () => {
    runVkQueue(db).catch((e) => console.error('[vk-queue]', e.message))
  })
  console.log('[vk-queue] автопостер ВК запущен: проверка очереди каждые 10 минут')
}

module.exports = { startVkQueueJob, runVkQueue, isEnabled }
