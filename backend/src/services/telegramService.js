'use strict'

// Постинг в Telegram-канал через Bot API: одно сообщение на пост — sendMessage (без фото) или
// sendPhoto с caption (с фото). HTML-форматирование (parse_mode: 'HTML'): заголовок жирным,
// ссылка «читать далее» — как кликабельный текст, а не голый URL. Никакой ссылки на лендинг в
// каждом посте (это отдельная рекламная история) — только `continueUrl` (пост в ВК с полным
// текстом), и то лишь когда текст не влезает в лимит и его пришлось обрезать.
//
// Требует Node 18+/20+ (глобальный fetch) — внешних зависимостей нет.

const API = 'https://api.telegram.org/bot'
// Лимиты Bot API считаются «after entities parsing» — по видимому тексту, теги разметки в счёт
// не идут. Лимит подписи к фото — 1024 символа, у обычного sendMessage — 4096 (у ВК такого
// ограничения на постах вообще нет). ponytail: считаем по .length (UTF-16 code units), не по
// точным правилам Telegram (эмодзи/суррогатные пары) — для текста постов достаточно.
const CAPTION_LIMIT = 1024
const MESSAGE_LIMIT = 4096
const READ_MORE_TEXT = 'Читать далее в ВК'

async function callApi(token, method, body, fetchImpl) {
  const res = await fetchImpl(`${API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, parse_mode: 'HTML' })
  })
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram ${method}: ${json.error_code} ${json.description}`)
  }
  return { messageId: json.result.message_id }
}

// Экранирование для HTML-режима Bot API — обязательно для текста между тегами.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Собирает HTML-текст поста: <b>заголовок</b> + тело. Если видимая длина (заголовок+тело)
// превышает лимит — обрезает тело по границе пробела (не рвать слово посередине) и добавляет
// кликабельную ссылку «Читать далее в ВК» вместо голого URL.
function buildText({ title, body, continueUrl, limit }) {
  const titleHtml = title ? `<b>${escapeHtml(title)}</b>\n\n` : ''
  const titleVisibleLen = title ? title.length + 2 : 0

  if (titleVisibleLen + body.length <= limit) {
    return `${titleHtml}${escapeHtml(body)}`
  }

  const linkHtml = `<a href="${continueUrl}">${READ_MORE_TEXT}</a>`
  const ellipsis = '…'
  const suffixVisibleLen = 2 + READ_MORE_TEXT.length // "\n\n" + видимый текст ссылки
  const budget = Math.max(limit - titleVisibleLen - suffixVisibleLen - ellipsis.length, 0)
  let cut = body.slice(0, budget)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > budget - 40) cut = cut.slice(0, lastSpace)
  return `${titleHtml}${escapeHtml(cut.trimEnd())}${ellipsis}\n\n${linkHtml}`
}

async function sendPost({ token, channelId, title, body, continueUrl, photoUrl }, fetchImpl = fetch) {
  const limit = photoUrl ? CAPTION_LIMIT : MESSAGE_LIMIT
  const text = buildText({ title, body, continueUrl, limit })
  if (!photoUrl) {
    return callApi(token, 'sendMessage', { chat_id: channelId, text }, fetchImpl)
  }
  return callApi(token, 'sendPhoto', { chat_id: channelId, photo: photoUrl, caption: text }, fetchImpl)
}

// Публичный канал — username в chat_id совпадает с частью ссылки на пост.
const postUrl = (channelId, messageId) => `https://t.me/${String(channelId).replace(/^@/, '')}/${messageId}`

module.exports = { sendPost, postUrl }
