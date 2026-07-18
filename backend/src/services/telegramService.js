'use strict'

// Постинг в Telegram-канал через Bot API: sendMessage (без фото) или sendPhoto (с caption).
// В отличие от ВК, ссылка в теле поста не режет охват в Telegram — текст и ссылка идут одним
// сообщением, без трюка «ссылка первым комментарием».
//
// Требует Node 18+/20+ (глобальный fetch) — внешних зависимостей нет.

const API = 'https://api.telegram.org/bot'

async function sendPost({ token, channelId, text, photoUrl }, fetchImpl = fetch) {
  const method = photoUrl ? 'sendPhoto' : 'sendMessage'
  const body = photoUrl
    ? { chat_id: channelId, photo: photoUrl, caption: text }
    : { chat_id: channelId, text }
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

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
