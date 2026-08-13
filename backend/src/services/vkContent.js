'use strict'

// Парсер файла контента для очереди ВК. Один файл — и человекочитаемый архив (для переноса
// в Дзен), и источник загрузки в очередь. Формат поста:
//
//   ## 2026-06-25 10:00 — Заголовок поста
//
//   Тело поста. Любое число строк и абзацев.
//
//   FAQ:
//   В: Вопрос?
//   О: Ответ.
//
//   В: Второй вопрос?
//   О: Второй ответ.
//
//   Telegram:
//   Короткая версия для Telegram-канала (необязательно). Хук, эмодзи, короткие абзацы —
//   без markdown-заголовков. Если секции нет — в Telegram уйдёт общий body (см. telegramQueueJob.js).
//
//   Теги: #дача #огород #полив
//   Картинка: https://images.pexels.com/...
//
// FAQ (необязательно) — только для блога на сайте (schema.org FAQPage, см. generate-blog.js);
// в ВК/Дзен/Telegram не публикуется, оттого и живёт отдельной секцией, а не частью body.
// Посты разделяются следующим заголовком "## ". Время трактуется как МСК (+03:00).

// "В: …\nО: …" (возможен многострочный ответ) — блоки разделены пустой строкой.
function parseFaq(text) {
  if (!text) return []
  return String(text).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    .map((block) => block.match(/^В:\s*(.+?)\n+О:\s*([\s\S]+)$/i))
    .filter(Boolean)
    .map((m) => ({ q: m[1].trim(), a: m[2].trim().replace(/\s*\n+\s*/g, ' ') }))
}

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
    let section = 'body' // 'body' | 'faq' | 'telegram' — переключается маркерами "FAQ:"/"Telegram:"
    const bodyLines = []
    const faqLines = []
    const tgLines = []
    const sectionLines = { body: bodyLines, faq: faqLines, telegram: tgLines }
    for (const ln of lines.slice(1)) {
      const t = ln.trim()
      if (/^Теги:/i.test(t)) { tags = t.replace(/^Теги:\s*/i, '').trim() || null; continue }
      if (/^Картинка:/i.test(t)) { image = t.replace(/^Картинка:\s*/i, '').trim() || null; continue }
      if (/^FAQ:\s*$/i.test(t)) { section = 'faq'; continue }
      if (/^Telegram:\s*$/i.test(t)) { section = 'telegram'; continue }
      sectionLines[section].push(ln)
    }
    posts.push({
      scheduledAt: `${date}T${time}:00+03:00`, // МСК
      title: title.trim(),
      body: bodyLines.join('\n').trim(),
      faq: parseFaq(faqLines.join('\n').trim()),
      telegramBody: tgLines.join('\n').trim() || null,
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
