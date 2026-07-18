'use strict'

// Постинг в Telegram-канал через Bot API: одно сообщение на пост — sendMessage (без фото) или
// sendPhoto с caption (с фото). В отличие от ВК, ссылка в теле поста не режет охват в Telegram —
// текст и ссылка идут одним сообщением, без трюка «ссылка первым комментарием».
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

// Обрезает body так, чтобы `${body}\n\n${link}` уложилось в лимит подписи — ссылка (важный CTA)
// сохраняется всегда целиком. Режет по границе пробела, если она рядом (не рвать слово посередине).
function fitCaption(body, link) {
  const suffix = `\n\n${link}`
  const ellipsis = '…'
  const budget = Math.max(CAPTION_LIMIT - suffix.length - ellipsis.length, 0)
  let cut = body.slice(0, budget)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > budget - 40) cut = cut.slice(0, lastSpace)
  return `${cut.trimEnd()}${ellipsis}${suffix}`
}

async function sendPost({ token, channelId, body, link, photoUrl }, fetchImpl = fetch) {
  const full = `${body}\n\n${link}`
  if (!photoUrl) {
    return callApi(token, 'sendMessage', { chat_id: channelId, text: full }, fetchImpl)
  }
  const caption = full.length <= CAPTION_LIMIT ? full : fitCaption(body, link)
  return callApi(token, 'sendPhoto', { chat_id: channelId, photo: photoUrl, caption }, fetchImpl)
}

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
