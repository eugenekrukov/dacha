'use strict'

// Постинг в сообщество ВК через VK API: пост на стену от имени группы, нативная загрузка фото,
// ссылка первым комментарием (ВК режет охват постам с внешней ссылкой в теле).
// Движок переиспользуют CLI (scripts/vk-autopost.js) и джоб-зеркало Дзена (jobs/dzenVkMirrorJob.js).
//
// Требует Node 18+/20+ (глобальные fetch/FormData/Blob) — внешних зависимостей нет.

const fs = require('fs')

const API = 'https://api.vk.com/method/'
const API_VERSION = '5.199'

// fetchImpl инъектируется в тестах.
function createVk({ token, fetchImpl = fetch } = {}) {
  async function call(method, params = {}) {
    const body = new URLSearchParams({ ...params, access_token: token, v: API_VERSION })
    const res = await fetchImpl(API + method, { method: 'POST', body })
    const json = await res.json()
    if (json.error) {
      throw new Error(`VK ${method}: ошибка ${json.error.error_code} — ${json.error.error_msg}`)
    }
    return json.response
  }
  return { call, fetchImpl }
}

// Стена сообщества адресуется отрицательным owner_id.
const wallOwnerId = (groupId) => -Math.abs(Number(groupId))
const attachmentOf = (photo) => `photo${photo.owner_id}_${photo.id}`

// Грубая защита от SSRF: image_url приходит из md-файлов контент-плана (scripts/vk-queue.js) —
// сейчас туда нет внешнего непроверенного ввода, но если этот путь когда-нибудь станет достижим
// через HTTP-роут или пользовательский контент, fetch на внутренний/служебный адрес (включая
// cloud-метадату 169.254.169.254) был бы реальной дырой. Без полноценного DNS-резолва и проверки
// IP (избыточно для текущего источника данных) — блокируем по очевидным хостам/диапазонам.
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h === '169.254.169.254') return true
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(h)
}

async function loadImageBytes(src, fetchImpl = fetch) {
  if (/^https?:\/\//i.test(src)) {
    const url = new URL(src)
    if (isBlockedHost(url.hostname)) {
      throw new Error(`Загрузка изображения с этого адреса запрещена: ${url.hostname}`)
    }
    const r = await fetchImpl(src)
    if (!r.ok) throw new Error(`Не удалось скачать изображение: HTTP ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  }
  return fs.readFileSync(src)
}

// Загрузка фото на стену сообщества: getWallUploadServer → upload → saveWallPhoto.
async function uploadWallPhoto(vk, groupId, bytes) {
  const gid = Math.abs(Number(groupId))
  const { upload_url } = await vk.call('photos.getWallUploadServer', { group_id: gid })
  const form = new FormData()
  form.append('photo', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg')
  const upRes = await vk.fetchImpl(upload_url, { method: 'POST', body: form })
  const up = await upRes.json()
  if (!up || up.photo == null || up.hash == null) {
    throw new Error(`VK upload: неожиданный ответ сервера загрузки фото: ${JSON.stringify(up).slice(0, 200)}`)
  }
  const saved = await vk.call('photos.saveWallPhoto', {
    group_id: gid, server: up.server, photo: up.photo, hash: up.hash
  })
  return saved[0] // { owner_id, id }
}

// Пост на стену + (опц.) ссылка первым комментарием. Возвращает post_id.
async function postToWall(vk, { groupId, message, photo, link }) {
  const params = { owner_id: wallOwnerId(groupId), from_group: 1, message }
  if (photo) params.attachments = attachmentOf(photo)
  const { post_id } = await vk.call('wall.post', params)
  // Комментарий со ссылкой — от лица АДМИНА (без from_group): комментирование от имени сообщества
  // требует community-токена (с user-токеном — ошибка 15 «could not access to this community»),
  // а пост мы уже опубликовали от имени группы. И «лучшим усилием»: пост уже опубликован, падение
  // комментария НЕ должно валить операцию, иначе ретрай продублирует пост (wall.post не идемпотентен).
  if (link) {
    try {
      await vk.call('wall.createComment', {
        owner_id: wallOwnerId(groupId), post_id, message: link
      })
    } catch (e) {
      console.error(`[vk] пост ${post_id} опубликован, но комментарий со ссылкой не добавлен: ${e.message}`)
    }
  }
  return post_id
}

const postUrl = (groupId, postId) => `https://vk.com/wall${wallOwnerId(groupId)}_${postId}`

module.exports = {
  createVk, wallOwnerId, attachmentOf, loadImageBytes, uploadWallPhoto, postToWall, postUrl
}
