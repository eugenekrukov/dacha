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

async function loadImageBytes(src, fetchImpl = fetch) {
  if (/^https?:\/\//i.test(src)) {
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
  // Комментарий со ссылкой — «лучшим усилием»: пост уже опубликован, и его падение НЕ должно
  // валить операцию, иначе вызывающий уйдёт в ретрай и продублирует пост (wall.post не идемпотентен).
  if (link) {
    try {
      await vk.call('wall.createComment', {
        owner_id: wallOwnerId(groupId), post_id, from_group: 1, message: link
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
