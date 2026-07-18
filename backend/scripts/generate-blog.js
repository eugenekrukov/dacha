'use strict'

/**
 * Генерирует статические страницы блога из файла контент-плана — того же формата,
 * что грузится в очередь автопостера ВК/Telegram (см. scripts/vk-queue.js,
 * src/services/vkContent.js). Сайт становится каноническим источником текста:
 * посты в соцсетях — то же самое + ссылка на статью.
 *
 *   node scripts/generate-blog.js <file.md>
 *
 * По уточнению владельца (2026-07-18): в блог не идут статьи, уже опубликованные в ВК —
 * только те, что появятся "с завтра". Фильтр по дате поста (scheduledAt), а не по файлу:
 * можно гонять тот же батч-файл повторно, уже прошедшие даты просто игнорируются каждый раз.
 * ponytail: фильтр — календарная дата > "сегодня" на момент запуска, а не факт публикации
 * в ВК (нет обращения к vk_post_queue.status) — апгрейд, если понадобится точность до поста,
 * а не до дня.
 * Slug — без даты, translitToSlug(заголовок), коллизии — числовой суффикс.
 * Идемпотентно: повторный прогон не плодит дублей — состояние в
 * backend/scripts/.blog-manifest.json (не коммитится, как и landing/spravochnik/ —
 * генерируется на VPS, см. docs/DEPLOY.md).
 */

const fs = require('fs')
const path = require('path')
const { parseContentFile } = require('../src/services/vkContent')
const { translitToSlug } = require('../src/utils/translit')
const {
  esc, writePage, renderShell, articleJsonLd, breadcrumbJsonLd, mergeSitemapUrls
} = require('./lib/seoPage')

const SITE = 'https://dacha.studio1008.com'
const OUT_DIR = path.join(__dirname, '..', '..', 'landing', 'blog')
const SITEMAP_PATH = path.join(__dirname, '..', '..', 'landing', 'sitemap.xml')
const MANIFEST_PATH = path.join(__dirname, '.blog-manifest.json')

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155
const SLUG_LIMIT = 60

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {}
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
}

// Тот же заголовок при повторном прогоне возвращает свой же slug (идемпотентность);
// другой заголовок, случайно давший тот же slug — получает числовой суффикс.
function buildSlug(title, manifest) {
  const base = translitToSlug(title).slice(0, SLUG_LIMIT).replace(/-+$/, '') || 'post'
  let slug = base
  let n = 2
  while (manifest[slug] && manifest[slug].title !== title) {
    slug = `${base}-${n}`
    n++
  }
  return slug
}

function inlineMd(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
}

// Тело поста → секции по подзаголовкам "### " (единственный уровень вложенности
// в контент-плане, см. docs/vk-content/*.md). Абзац до первого подзаголовка — лид-абзац.
// В исходниках заголовок и следующий за ним текст НЕ разделены пустой строкой
// ("### Заголовок\nТекст сразу с новой строки") — проверяем только первую строку блока,
// остаток блока после заголовка уходит в тело этой же секции.
function mdBodyToSections(text) {
  const blocks = String(text).split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  const sections = []
  let current = null
  for (const block of blocks) {
    const lines = block.split('\n')
    const h = lines[0].match(/^#{1,6}\s+(.+)$/)
    if (h) {
      current = { heading: h[1], paragraphs: [] }
      sections.push(current)
      const rest = lines.slice(1).join('\n').trim()
      if (rest) current.paragraphs.push(rest)
    } else if (current) {
      current.paragraphs.push(block)
    } else {
      sections.push({ heading: null, paragraphs: [block] })
    }
  }
  return sections
}

function buildTitle(title) {
  const withBrand = `${title} | Календарь дачника`
  return withBrand.length <= TITLE_LIMIT ? withBrand : title
}

function buildDescription(body) {
  const firstPara = String(body).split(/\n\s*\n/)[0].replace(/^#{1,6}\s+/, '').trim()
  return firstPara.length <= DESCRIPTION_LIMIT ? firstPara : firstPara.slice(0, DESCRIPTION_LIMIT - 1).trim() + '…'
}

function renderPostBody(post) {
  let html = `<h1>${esc(post.title)}</h1>`
  html += `<div><span class="badge">${esc(post.dateLabel)}</span></div>`
  if (post.image) html += `<img class="photo" src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy">`
  for (const s of mdBodyToSections(post.body)) {
    const body = s.paragraphs.map(p => `<p>${inlineMd(p).replace(/\n/g, '<br>')}</p>`).join('')
    html += s.heading ? `<div class="card"><h2>${inlineMd(s.heading)}</h2>${body}</div>` : body
  }
  html += `<a class="cta" href="/app/">🌱 Открыть «Календарь дачника» →</a>`
  return html
}

function renderIndex(posts) {
  let html = '<h1>Блог «Календаря дачника»</h1>'
  html += '<p>Разборы конкретных ситуаций на грядке — что делать и почему именно так.</p>'
  html += '<div class="grid">'
  html += posts.map(p => `<a href="/blog/${p.slug}/">${esc(p.dateLabel)} — ${esc(p.title)}</a>`).join('')
  html += '</div>'
  return html
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Использование: node scripts/generate-blog.js <file.md>')
    process.exit(1)
  }
  const md = fs.readFileSync(file, 'utf8')
  const parsed = parseContentFile(md)
  if (parsed.length === 0) {
    console.error('Посты не найдены. Формат заголовка: "## YYYY-MM-DD HH:MM — Заголовок"')
    process.exit(1)
  }

  // В блог — только то, что ещё не опубликовано в ВК ("появится с завтра"), а не весь файл:
  // дата поста строго позже сегодняшней на момент запуска. Уже прошедшие/сегодняшние посты
  // из того же батча пропускаются молча (это ожидаемо при повторном запуске на старом файле).
  const todayStr = new Date().toISOString().slice(0, 10)
  const eligible = parsed.filter(p => p.scheduledAt.slice(0, 10) > todayStr)
  const skipped = parsed.length - eligible.length

  const manifest = loadManifest()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const post of eligible) {
    const slug = buildSlug(post.title, manifest)
    const dateLabel = new Date(post.scheduledAt).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    const canonical = `${SITE}/blog/${slug}/`

    const dir = path.join(OUT_DIR, slug)
    fs.mkdirSync(dir, { recursive: true })
    writePage(path.join(dir, 'index.html'), renderShell({
      title: buildTitle(post.title),
      description: buildDescription(post.body),
      canonical,
      breadcrumbs: `<a href="/">Главная</a> / <a href="/blog/">Блог</a> / ${esc(post.title)}`,
      bodyHtml: renderPostBody({ ...post, dateLabel }),
      jsonLdBlocks: [
        articleJsonLd(post.title, canonical, { datePublished: post.scheduledAt }),
        breadcrumbJsonLd([
          { name: 'Главная', url: `${SITE}/` },
          { name: 'Блог', url: `${SITE}/blog/` },
          { name: post.title, url: canonical }
        ])
      ]
    }))

    manifest[slug] = { title: post.title, scheduledAt: post.scheduledAt, dateLabel, sourceFile: path.basename(file) }
  }

  saveManifest(manifest)

  const allPosts = Object.entries(manifest)
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

  writePage(path.join(OUT_DIR, 'index.html'), renderShell({
    title: 'Блог — Календарь дачника',
    description: 'Разборы садовых и огородных вопросов от «Календаря дачника»: что делать и почему.',
    canonical: `${SITE}/blog/`,
    breadcrumbs: '<a href="/">Главная</a> / Блог',
    bodyHtml: renderIndex(allPosts)
  }))

  // isOwned: только /blog/* — записи spravochnik/статики от другого генератора не трогаем.
  const urls = [
    { loc: `${SITE}/blog/`, priority: '0.5', freq: 'weekly' },
    ...allPosts.map(p => ({ loc: `${SITE}/blog/${p.slug}/`, priority: '0.4', freq: 'yearly' }))
  ]
  mergeSitemapUrls(SITEMAP_PATH, (loc) => loc.startsWith(`${SITE}/blog/`), urls)

  console.log(`Готово: добавлено новых постов из "${path.basename(file)}" — ${eligible.length}` +
    (skipped > 0 ? ` (пропущено уже опубликованных/сегодняшних — ${skipped})` : '') +
    `, всего в блоге — ${allPosts.length}.`)
}

main()
