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
const PAGE_SIZE = 12

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
  html += `<div><time class="badge" datetime="${esc(post.scheduledAt)}">${esc(post.dateLabel)}</time></div>`
  if (post.image) html += `<img class="photo" src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy">`
  html += '<article class="article-body">'
  let leadDone = false
  for (const s of mdBodyToSections(post.body)) {
    const body = s.paragraphs.map(p => {
      const cls = leadDone ? '' : ' class="lead"'
      leadDone = true
      return `<p${cls}>${inlineMd(p).replace(/\n/g, '<br>')}</p>`
    }).join('')
    html += s.heading ? `<h2>${inlineMd(s.heading)}</h2>${body}` : body
  }
  html += '</article>'
  html += `<a class="cta" href="/app/">🌱 Открыть «Календарь дачника» →</a>`
  return html
}

// Плейсхолдер для постов без картинки (parseContentFile.image может быть null) —
// чтобы сетка не «прыгала» из-за карточек разной формы.
function renderCardMedia(post) {
  return post.image
    ? `<img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy">`
    : `<div class="blog-card-media-fallback">🌱</div>`
}

function pageUrl(page) {
  return page <= 1 ? '/blog/' : `/blog/page/${page}/`
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) return ''
  let html = '<nav class="pagination" aria-label="Страницы блога">'
  if (page > 1) html += `<a href="${pageUrl(page - 1)}" aria-label="Предыдущая страница">‹</a>`
  for (let p = 1; p <= totalPages; p++) {
    html += p === page
      ? `<span class="current" aria-current="page">${p}</span>`
      : `<a href="${pageUrl(p)}">${p}</a>`
  }
  if (page < totalPages) html += `<a href="${pageUrl(page + 1)}" aria-label="Следующая страница">›</a>`
  html += '</nav>'
  return html
}

function renderIndex(pagePosts, page, totalPages) {
  let html = '<h1>Блог «Календаря дачника»</h1>'
  html += '<p>Разборы конкретных ситуаций на грядке — что делать и почему именно так.</p>'
  html += '<div class="blog-grid">'
  html += pagePosts.map(p => `
    <a class="blog-card" href="/blog/${p.slug}/">
      ${renderCardMedia(p)}
      <div class="blog-card-body">
        <div class="blog-card-title">${esc(p.title)}</div>
        <div class="blog-card-date">${esc(p.dateLabel)}</div>
      </div>
    </a>`).join('')
  html += '</div>'
  html += renderPagination(page, totalPages)
  return html
}

function main() {
  const file = process.argv[2]
  const force = process.argv.includes('--force')
  if (!file) {
    console.error('Использование: node scripts/generate-blog.js <file.md> [--force]')
    process.exit(1)
  }
  const md = fs.readFileSync(file, 'utf8')
  const parsed = parseContentFile(md)
  if (parsed.length === 0) {
    console.error('Посты не найдены. Формат заголовка: "## YYYY-MM-DD HH:MM — Заголовок"')
    process.exit(1)
  }

  const manifest = loadManifest()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // В блог — только то, что ещё не опубликовано в ВК ("появится с завтра"), а не весь файл:
  // дата поста строго позже сегодняшней на момент запуска. Уже прошедшие/сегодняшние посты
  // из того же батча пропускаются молча (это ожидаемо при повторном запуске на старом файле).
  // --force: дополнительно перегенерировать уже опубликованные посты этого файла (те, что уже
  // есть в манифесте) — например, после правки шаблона (renderPostBody/CSS). Новых прошедших
  // постов, которых ещё нет в манифесте, --force не добавляет — правило "не публикуем прошедшее"
  // остаётся в силе, флаг только освежает то, что уже вышло.
  const alreadyPublished = new Set(Object.values(manifest).map(p => p.title))
  const todayStr = new Date().toISOString().slice(0, 10)
  const eligible = parsed.filter(p =>
    p.scheduledAt.slice(0, 10) > todayStr || (force && alreadyPublished.has(p.title))
  )
  const skipped = parsed.length - eligible.length

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
      activeNav: 'blog',
      jsonLdBlocks: [
        articleJsonLd(post.title, canonical, {
          '@type': 'BlogPosting',
          description: buildDescription(post.body),
          datePublished: post.scheduledAt,
          dateModified: post.scheduledAt,
          image: post.image ? [post.image] : undefined,
          author: { '@type': 'Person', name: 'Крюков Евгений Владимирович' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
          speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.lead'] }
        }),
        breadcrumbJsonLd([
          { name: 'Главная', url: `${SITE}/` },
          { name: 'Блог', url: `${SITE}/blog/` },
          { name: post.title, url: canonical }
        ])
      ]
    }))

    manifest[slug] = {
      title: post.title, scheduledAt: post.scheduledAt, dateLabel, image: post.image || null,
      sourceFile: path.basename(file)
    }
  }

  saveManifest(manifest)

  const allPosts = Object.entries(manifest)
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

  // Пагинация — по PAGE_SIZE статей. Старые страницы пагинации, которых больше не должно
  // существовать (список статей уменьшился — редкость, но не будет висеть мёртвых html),
  // подчищаем перед повторной записью.
  fs.rmSync(path.join(OUT_DIR, 'page'), { recursive: true, force: true })
  const totalPages = Math.max(1, Math.ceil(allPosts.length / PAGE_SIZE))
  for (let page = 1; page <= totalPages; page++) {
    const pagePosts = allPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const dir = page === 1 ? OUT_DIR : path.join(OUT_DIR, 'page', String(page))
    fs.mkdirSync(dir, { recursive: true })
    writePage(path.join(dir, 'index.html'), renderShell({
      title: page === 1 ? 'Блог — Календарь дачника' : `Блог — страница ${page} — Календарь дачника`,
      description: 'Разборы садовых и огородных вопросов от «Календаря дачника»: что делать и почему.',
      canonical: `${SITE}${pageUrl(page)}`,
      breadcrumbs: '<a href="/">Главная</a> / Блог',
      bodyHtml: renderIndex(pagePosts, page, totalPages),
      activeNav: 'blog'
    }))
  }

  // isOwned: только /blog/* — записи spravochnik/статики от другого генератора не трогаем.
  const urls = [
    { loc: `${SITE}/blog/`, priority: '0.5', freq: 'weekly' },
    ...Array.from({ length: totalPages - 1 }, (_, i) => ({
      loc: `${SITE}${pageUrl(i + 2)}`, priority: '0.3', freq: 'weekly'
    })),
    ...allPosts.map(p => ({ loc: `${SITE}/blog/${p.slug}/`, priority: '0.4', freq: 'yearly' }))
  ]
  mergeSitemapUrls(SITEMAP_PATH, (loc) => loc.startsWith(`${SITE}/blog/`), urls)

  console.log(`Готово: добавлено новых постов из "${path.basename(file)}" — ${eligible.length}` +
    (skipped > 0 ? ` (пропущено уже опубликованных/сегодняшних — ${skipped})` : '') +
    `, всего в блоге — ${allPosts.length}.`)
}

main()
