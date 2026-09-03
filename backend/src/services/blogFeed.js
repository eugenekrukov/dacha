'use strict'

// Фид блога для приложения (GET /blog/feed) — читает те же файлы, что уже пишет
// backend/scripts/generate-blog.js: манифест (slug → title/дата/картинка/sourceFile) +
// исходники контент-плана (docs/vk-content/*.md), лид достаём тем же парсером, что и
// автопостер (parseContentFile). Ни таблицы, ни нового шага деплоя.
//
// Кэш в памяти, инвалидация по mtimeMs манифеста — перегенерация блога сразу видна,
// без TTL. Пути переопределяются env (BLOG_MANIFEST_PATH/BLOG_CONTENT_DIR) — так тесты
// подставляют фикстуры.

const fs = require('fs')
const path = require('path')
const { parseContentFile } = require('./vkContent')

const SITE = 'https://calendacha.ru'
const LEAD_LIMIT = 200

function manifestPath() {
  return process.env.BLOG_MANIFEST_PATH || path.join(__dirname, '..', '..', 'scripts', '.blog-manifest.json')
}

function contentDir() {
  return process.env.BLOG_CONTENT_DIR || path.join(__dirname, '..', '..', '..', 'docs', 'vk-content')
}

// Обрезка на границе слова — «…» вместо оборванного слова.
function truncateAtWord(text, limit) {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}

// Первый абзац тела поста → лид карточки: снять заголовок/жирный, обрезать по 200 символов.
function extractLead(body) {
  if (!body) return null
  const firstPara = String(body).split(/\n\s*\n/)[0]
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim()
  return firstPara ? truncateAtWord(firstPara, LEAD_LIMIT) : null
}

function computeItems(manifest, dir) {
  // Группируем записи манифеста по sourceFile, чтобы парсить каждый .md один раз.
  const bySource = new Map()
  for (const [slug, entry] of Object.entries(manifest)) {
    if (!bySource.has(entry.sourceFile)) bySource.set(entry.sourceFile, [])
    bySource.get(entry.sourceFile).push({ slug, ...entry })
  }

  const now = Date.now()
  const items = []
  for (const [sourceFile, entries] of bySource) {
    const filePath = path.join(dir, sourceFile)
    let postsByTitle = new Map()
    if (fs.existsSync(filePath)) {
      const posts = parseContentFile(fs.readFileSync(filePath, 'utf8'))
      postsByTitle = new Map(posts.map((p) => [p.title, p]))
    }
    for (const entry of entries) {
      if (new Date(entry.scheduledAt).getTime() > now) continue // «на завтра» — ещё не в фиде
      const post = postsByTitle.get(entry.title) // заголовок правили после публикации → лида нет
      items.push({
        slug: entry.slug,
        title: entry.title,
        url: `${SITE}/blog/${entry.slug}/`,
        published_at: entry.scheduledAt,
        image: entry.image || null,
        lead: post ? extractLead(post.body) : null
      })
    }
  }

  items.sort((a, b) => {
    const diff = new Date(b.published_at) - new Date(a.published_at)
    return diff !== 0 ? diff : a.slug.localeCompare(b.slug)
  })
  return items
}

let cache = null // { path, mtimeMs, items }

// Список статей, отсортированный по дате ↓. Пагинация — на вызывающей стороне (роуте).
function getBlogFeedItems() {
  const mPath = manifestPath()
  if (!fs.existsSync(mPath)) {
    cache = null
    return []
  }
  const mtimeMs = fs.statSync(mPath).mtimeMs
  if (!cache || cache.path !== mPath || cache.mtimeMs !== mtimeMs) {
    const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'))
    cache = { path: mPath, mtimeMs, items: computeItems(manifest, contentDir()) }
  }
  return cache.items
}

module.exports = { getBlogFeedItems, extractLead }
