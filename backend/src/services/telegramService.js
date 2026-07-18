'use strict'

// Постинг в Telegram-канал через Bot API: sendMessage (без фото) или sendPhoto (с caption).
// В отличие от ВК, ссылка в теле поста не режет охват в Telegram — текст и ссылка идут одним
// сообщением, без трюка «ссылка первым комментарием».
//
// Требует Node 18+/20+ (глобальный fetch) — внешних зависимостей нет.

const API = 'https://api.telegram.org/bot'
// Лимит подписи к фото у Bot API — 1024 символа (у обычного sendMessage — 4096, у ВК такого
// ограничения на постах вообще нет). ponytail: считаем по .length (UTF-16 code units), не по
// точным правилам Telegram (эмодзи/суррогатные пары) — для текста постов достаточно.
const CAPTION_LIMIT = 1024

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

async function sendPost({ token, channelId, text, photoUrl }, fetchImpl = fetch) {
  if (!photoUrl) {
    return callApi(token, 'sendMessage', { chat_id: channelId, text }, fetchImpl)
  }
  if (text.length <= CAPTION_LIMIT) {
    return callApi(token, 'sendPhoto', { chat_id: channelId, photo: photoUrl, caption: text }, fetchImpl)
  }
  // Текст не помещается в подпись к фото — публикуем фото без подписи, текст отдельным
  // сообщением следом (сохраняем в messageId именно фото — это первое, что видно в канале).
  const photo = await callApi(token, 'sendPhoto', { chat_id: channelId, photo: photoUrl }, fetchImpl)
  await callApi(token, 'sendMessage', { chat_id: channelId, text }, fetchImpl)
  return photo
}

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
