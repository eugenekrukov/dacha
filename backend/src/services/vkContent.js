'use strict'

// Парсер файла контента для очереди ВК. Один файл — и человекочитаемый архив (для переноса
// в Дзен), и источник загрузки в очередь. Формат поста:
//
//   ## 2026-06-25 10:00 — Заголовок поста
//
//   Тело поста. Любое число строк и абзацев.
//
//   Теги: #дача #огород #полив
//   Картинка: https://images.pexels.com/...
//
// Посты разделяются следующим заголовком "## ". Время трактуется как МСК (+03:00).

function parseContentFile(md) {
  const posts = []
  const blocks = String(md || '').split(/\n(?=## )/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    // Разделитель заголовка — тире любого вида: em (—), en (–) или дефис (-).
    const m = lines[0].match(/^##\s+(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})\s+[—–-]\s+(.+)$/)
    if (!m) continue
    const [, date, time, title] = m

    let tags = null
    let image = null
    const bodyLines = []
    for (const ln of lines.slice(1)) {
      const t = ln.trim()
      if (/^Теги:/i.test(t)) { tags = t.replace(/^Теги:\s*/i, '').trim() || null; continue }
      if (/^Картинка:/i.test(t)) { image = t.replace(/^Картинка:\s*/i, '').trim() || null; continue }
      bodyLines.push(ln)
    }
    posts.push({
      scheduledAt: `${date}T${time}:00+03:00`, // МСК
      title: title.trim(),
      body: bodyLines.join('\n').trim(),
      tags,
      image
    })
  }
  return posts
}

// ВК и Дзен не рендерят markdown — заголовки/жирный/курсив показываются буквально
// (решёткой и звёздочками). Снимаем разметку перед публикацией, а не правкой каждого файла контента.
function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
}

// Текст поста для ВК: тело + теги в конце (ссылка идёт отдельным комментарием).
function queueMessage(post) {
  const body = stripMarkdown(post.body)
  return post.tags ? `${body}\n\n${post.tags}` : body
}

module.exports = { parseContentFile, queueMessage }
