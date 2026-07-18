'use strict'

// Постинг в Telegram-канал через Bot API: одно сообщение на пост — sendMessage (без фото) или
// sendPhoto с caption (с фото). Никакой ссылки на лендинг в каждом посте (это отдельная рекламная
// история, не контентная) — только `continueUrl` (пост в ВК с полным текстом), и то лишь когда
// текст не влезает в лимит подписи и его пришлось обрезать.
//
// Требует Node 18+/20+ (глобальный fetch) — внешних зависимостей нет.

const API = 'https://api.telegram.org/bot'
// Лимит подписи к фото у Bot API — 1024 символа (у обычного sendMessage — 4096, у ВК такого
// ограничения на постах вообще нет). ponytail: считаем по .length (UTF-16 code units), не по
// точным правилам Telegram (эмодзи/суррогатные пары) — для текста постов достаточно.
const CAPTION_LIMIT = 1024
const MESSAGE_LIMIT = 4096

async function callApi(token, method, body, fetchImpl) {
  const res = await fetchImpl(`${API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram ${method}: ${json.error_code} ${json.description}`)
  }
  return { messageId: json.result.message_id }
}

// Обрезает body под лимит `limit`, добавляя «Читать полностью: {continueUrl}» — так читатель
// всегда знает, где продолжение, вместо обрыва посреди слова. Режет по границе пробела, если она
// рядом (не рвать слово посередине).
function fitText(body, continueUrl, limit) {
  const suffix = `\n\nЧитать полностью: ${continueUrl}`
  const ellipsis = '…'
  const budget = Math.max(limit - suffix.length - ellipsis.length, 0)
  let cut = body.slice(0, budget)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > budget - 40) cut = cut.slice(0, lastSpace)
  return `${cut.trimEnd()}${ellipsis}${suffix}`
}

async function sendPost({ token, channelId, body, continueUrl, photoUrl }, fetchImpl = fetch) {
  const limit = photoUrl ? CAPTION_LIMIT : MESSAGE_LIMIT
  const text = body.length <= limit ? body : fitText(body, continueUrl, limit)
  if (!photoUrl) {
    return callApi(token, 'sendMessage', { chat_id: channelId, text }, fetchImpl)
  }
  return callApi(token, 'sendPhoto', { chat_id: channelId, photo: photoUrl, caption: text }, fetchImpl)
}

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
