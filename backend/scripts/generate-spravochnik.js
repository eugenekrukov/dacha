'use strict'

/**
 * Генерирует статические SEO-страницы справочника культур и проблем растений
 * из данных crops / guide_entries / crop_guide_entries в landing/spravochnik/.
 * Дизайн: docs/superpowers/specs/2026-07-01-spravochnik-seo-pages-design.md
 *
 *   node scripts/generate-spravochnik.js
 *
 * Использует .env backend (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD). Только
 * читает БД. Перезаписывает landing/spravochnik/ целиком и landing/sitemap.xml.
 * Запускать ПОСЛЕ backfill-crop-slugs.js (иначе культуры без slug получат
 * нестабильный временный slug на лету — см. предупреждение в консоли).
 */

require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const { translitToSlug } = require('../src/utils/translit')
const { dayOfYearToDateLabel } = require('../src/utils/dayOfYear')

const SITE = 'https://dacha.studio1008.com'
const OUT_DIR = path.join(__dirname, '..', '..', 'landing', 'spravochnik')
const SITEMAP_PATH = path.join(__dirname, '..', '..', 'landing', 'sitemap.xml')

const CATEGORY_LABELS = {
  vegetable: 'Овощи', berry: 'Ягоды', fruit: 'Фрукты', herb: 'Зелень', flower: 'Цветы'
}
const KIND_LABELS = {
  deficiency: 'Дефициты микроэлементов', disease: 'Болезни', pest: 'Вредители'
}

let cropsById = new Map()

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// SEO: title >60 симв. обрезается в сниппете поиска (для кириллицы порог даже
// чуть жёстче латиницы). Приоритет при переполнении — отбросить бренд-суффикс
// (он и так виден в сниппете отдельной строкой домена), а не резать само
// название культуры/проблемы — обрезка названия по буквам вводит в заблуждение.
const TITLE_LIMIT = 60

function buildCropTitle(name) {
  const withBrand = `${name} — когда сажать и как ухаживать | Календарь дачника`
  if (withBrand.length <= TITLE_LIMIT) return withBrand
  return `${name} — когда сажать и как ухаживать`
}

function buildEntryTitle(name) {
  const withBrand = `${name} — признаки и лечение | Календарь дачника`
  if (withBrand.length <= TITLE_LIMIT) return withBrand
  return `${name} — признаки и лечение`
}

// SEO: description >160 симв. обрезается в сниппете. Бюджет считаем от общей
// длины строки (префикс + факт из БД), а не режем факт фиксированным куском —
// иначе при длинном названии сумма всё равно могла перевалить за 160.
const DESCRIPTION_LIMIT = 155

function buildEntryDescription(entry) {
  const prefix = `${entry.name}: как распознать и что делать. `
  const budget = Math.max(0, DESCRIPTION_LIMIT - prefix.length)
  return prefix + (entry.description || '').slice(0, budget)
}

function textToHtml(text) {
  if (!text) return ''
  return String(text)
    .split(/\n\s*\n/)
    .map(block => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function writePage(filePath, html) {
  fs.writeFileSync(filePath, html, 'utf8')
}

function countHtmlFiles(dir) {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) count += countHtmlFiles(full)
    else if (entry.name.endsWith('.html')) count += 1
  }
  return count
}

function articleJsonLd(name, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: name,
    url,
    inLanguage: 'ru',
    publisher: {
      '@type': 'Person',
      name: 'Крюков Евгений Владимирович',
      email: 'dacha@studio1008.com'
    }
  }
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url
    }))
  }
}

function renderShell({ title, description, canonical, breadcrumbs, bodyHtml, jsonLdBlocks }) {
  const jsonLdHtml = (jsonLdBlocks || [])
    .map(block => `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`)
    .join('\n')
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#FF7B00">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Календарь дачника">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/spravochnik/assets/style.css">
${jsonLdHtml}
</head>
<body>
<header><div class="wrap"><a class="brand" href="/">🌻 Календарь дачника</a></div></header>
<main><div class="wrap">
<div class="breadcrumbs">${breadcrumbs}</div>
${bodyHtml}
</div></main>
<footer><div class="wrap">
<a href="/offer">Оферта</a> · <a href="/privacy">Политика конфиденциальности</a> · <a href="/">На главную</a>
<div>© 2026 «Календарь дачника»</div>
</div></footer>
</body>
</html>`
}

function renderHub() {
  return `<h1>Справочник «Календаря дачника»</h1>
<p>Всё, что приложение знает о культурах и проблемах растений — в открытом доступе.</p>
<div class="grid">
  <a href="/spravochnik/kultury/">🌱 Культуры: сроки посадки и ухода</a>
  <a href="/spravochnik/problemy/">🩺 Проблемы: болезни, вредители, дефициты</a>
</div>`
}

function renderKulturyIndex(crops) {
  const byCategory = new Map()
  for (const c of crops) {
    const cat = c.category || 'other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat).push(c)
  }
  let html = '<h1>Справочник культур</h1><p>Сроки посева, ухода и совместимость для культур из «Календаря дачника».</p>'
  for (const [cat, list] of byCategory) {
    html += `<h2>${esc(CATEGORY_LABELS[cat] || cat)}</h2><div class="grid">`
    html += list.map(c => `<a href="/spravochnik/kultury/${c.slug}/">${esc(c.name)}</a>`).join('')
    html += '</div>'
  }
  return html
}

function renderProblemyIndex(entries) {
  const byKind = new Map()
  for (const e of entries) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, [])
    byKind.get(e.kind).push(e)
  }
  let html = '<h1>Справочник проблем растений</h1><p>Дефициты микроэлементов, болезни и вредители — признаки и лечение.</p>'
  for (const [kind, list] of byKind) {
    html += `<h2>${esc(KIND_LABELS[kind] || kind)}</h2><div class="grid">`
    html += list.map(e => `<a href="/spravochnik/problemy/${e.slug}/">${esc(e.name)}</a>`).join('')
    html += '</div>'
  }
  return html
}

function renderCropBody(crop, relatedEntries) {
  const sowing = (crop.sowing_start_day && crop.sowing_end_day)
    ? `с ${dayOfYearToDateLabel(crop.sowing_start_day)} по ${dayOfYearToDateLabel(crop.sowing_end_day)}`
    : null
  const companions = (crop.companion_crops || []).map(id => cropsById.get(id)).filter(Boolean)

  let html = `<h1>${esc(crop.name)}</h1><div>`
  if (crop.category) html += `<span class="badge">${esc(CATEGORY_LABELS[crop.category] || crop.category)}</span>`
  if (crop.family) html += `<span class="badge">${esc(crop.family)}</span>`
  html += '</div>'

  html += '<div class="card"><h2>Сроки и уход</h2>'
  html += `<p>Посев: ${sowing ? esc(sowing) : 'сроки индивидуальны для региона'}.</p>`
  if (crop.transplant_days) html += `<p>Высадка рассады: через ${crop.transplant_days} дн. после всходов.</p>`
  if (crop.harvest_days) html += `<p>Сбор урожая: через ${crop.harvest_days} дн. после посадки.</p>`
  html += `<p>Полив: раз в ${crop.watering_freq_days || 3} дн.</p>`
  html += `<p>${crop.frost_sensitive ? 'Чувствительна к заморозкам' : 'Устойчива к лёгким заморозкам'}.</p>`
  html += '</div>'

  if (crop.notes) html += `<div class="card"><h2>Заметки</h2>${textToHtml(crop.notes)}</div>`

  if (companions.length) {
    html += `<div class="related"><h2>Хорошо соседствуют</h2><ul>${
      companions.map(c => `<li><a href="/spravochnik/kultury/${c.slug}/">${esc(c.name)}</a></li>`).join('')
    }</ul></div>`
  }

  if (relatedEntries.length) {
    html += `<div class="related"><h2>Возможные проблемы</h2><ul>${
      relatedEntries.map(e => `<li><a href="/spravochnik/problemy/${e.slug}/">${esc(e.name)}</a></li>`).join('')
    }</ul></div>`
  }

  html += `<a class="cta" href="/app/">🌱 Добавить «${esc(crop.name)}» в свой Календарь дачника →</a>`
  return html
}

function renderEntryBody(entry, affectedCrops) {
  let html = `<h1>${esc(entry.name)}</h1><div>`
  html += `<span class="badge">${esc(KIND_LABELS[entry.kind] || entry.kind)}</span>`
  if (entry.danger) html += `<span class="badge">Опасность: ${'⚠️'.repeat(Math.min(3, entry.danger))}</span>`
  html += '</div>'

  if (entry.image_url) {
    html += `<img class="photo" src="${esc(entry.image_url)}" alt="${esc(entry.name)}" loading="lazy">`
    if (entry.image_credit) html += `<div class="photo-credit">Фото: ${esc(entry.image_credit)}</div>`
  }

  const fields = [
    ['Описание', entry.description],
    ['Симптомы', entry.symptoms],
    ['Причины', entry.conditions],
    ['Лечение', entry.treatment],
    ['Профилактика', entry.prevention]
  ]
  for (const [label, value] of fields) {
    if (value) html += `<div class="card"><h2>${label}</h2>${textToHtml(value)}</div>`
  }
  if (entry.season) html += `<p><b>Период риска:</b> ${esc(entry.season)}</p>`

  if (affectedCrops.length) {
    html += '<div class="related"><h2>Поражает культуры</h2>'
    for (const link of affectedCrops) {
      html += `<div class="card"><h2><a href="/spravochnik/kultury/${link.crop.slug}/">${esc(link.crop.name)}</a></h2>`
      const img = link.image_url || entry.image_url
      const credit = link.image_url ? link.image_credit : entry.image_credit
      if (img) {
        html += `<img class="photo" src="${esc(img)}" alt="${esc(entry.name)} у ${esc(link.crop.name)}" loading="lazy">`
        if (credit) html += `<div class="photo-credit">Фото: ${esc(credit)}</div>`
      }
      if (link.signs) html += `<p>${esc(link.signs)}</p>`
      html += '</div>'
    }
    html += '</div>'
  }

  html += `<a class="cta" href="/app/">🌱 Открыть Календарь дачника →</a>`
  return html
}

function writeSitemap(crops, entries) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    { loc: `${SITE}/`, priority: '1.0', freq: 'monthly' },
    { loc: `${SITE}/offer`, priority: '0.3', freq: 'yearly' },
    { loc: `${SITE}/privacy`, priority: '0.3', freq: 'yearly' },
    { loc: `${SITE}/account-deletion`, priority: '0.3', freq: 'yearly' },
    { loc: `${SITE}/spravochnik/`, priority: '0.6', freq: 'monthly' },
    { loc: `${SITE}/spravochnik/kultury/`, priority: '0.5', freq: 'monthly' },
    { loc: `${SITE}/spravochnik/problemy/`, priority: '0.5', freq: 'monthly' },
    ...crops.map(c => ({ loc: `${SITE}/spravochnik/kultury/${c.slug}/`, priority: '0.4', freq: 'yearly' })),
    ...entries.map(e => ({ loc: `${SITE}/spravochnik/problemy/${e.slug}/`, priority: '0.4', freq: 'yearly' }))
  ]
  const body = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8')
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'dacha_db',
    user: process.env.DB_USER || 'dacha_user',
    password: process.env.DB_PASSWORD || ''
  })

  const cropsRes = await pool.query(
    `SELECT id, slug, name, category, family, sowing_start_day, sowing_end_day,
            transplant_days, harvest_days, watering_freq_days, frost_sensitive,
            companion_crops, notes
     FROM crops ORDER BY name ASC`
  )
  const entriesRes = await pool.query(
    `SELECT id, slug, name, kind, element, category, danger, description, symptoms,
            conditions, treatment, prevention, season, image_url, image_credit
     FROM guide_entries ORDER BY name ASC`
  )
  const linksRes = await pool.query(
    'SELECT crop_id, entry_id, signs, image_url, image_credit FROM crop_guide_entries'
  )
  await pool.end()

  // slug + коллизии
  const cropSlugSeen = new Set()
  const crops = []
  for (const row of cropsRes.rows) {
    let slug = row.slug
    if (!slug) {
      slug = translitToSlug(row.name) || `crop-${row.id}`
      console.warn(`⚠️  Культура #${row.id} "${row.name}" без slug в БД — временный "${slug}" (запустите backfill-crop-slugs.js для стабильного URL).`)
    }
    if (cropSlugSeen.has(slug)) throw new Error(`Коллизия slug культуры: "${slug}" (#${row.id} "${row.name}")`)
    cropSlugSeen.add(slug)
    crops.push({ ...row, slug })
  }

  const entrySlugSeen = new Set()
  for (const row of entriesRes.rows) {
    if (entrySlugSeen.has(row.slug)) throw new Error(`Коллизия slug записи справочника: "${row.slug}"`)
    entrySlugSeen.add(row.slug)
  }
  const entries = entriesRes.rows

  cropsById = new Map(crops.map(c => [c.id, c]))

  for (const crop of crops) {
    for (const companionId of (crop.companion_crops || [])) {
      if (!cropsById.has(companionId)) {
        console.warn(`⚠️  Культура #${crop.id} "${crop.name}": companion_crops содержит несуществующий id ${companionId} — пропущено на странице.`)
      }
    }
  }

  const entriesById = new Map(entries.map(e => [e.id, e]))
  const cropToLinks = new Map()
  const entryToLinks = new Map()
  for (const link of linksRes.rows) {
    if (!cropToLinks.has(link.crop_id)) cropToLinks.set(link.crop_id, [])
    cropToLinks.get(link.crop_id).push(link)
    if (!entryToLinks.has(link.entry_id)) entryToLinks.set(link.entry_id, [])
    entryToLinks.get(link.entry_id).push(link)
  }

  // чистая пересборка каталога (только регенерируемые подпапки — assets/ и прочее в OUT_DIR не трогаем)
  fs.rmSync(path.join(OUT_DIR, 'kultury'), { recursive: true, force: true })
  fs.rmSync(path.join(OUT_DIR, 'problemy'), { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT_DIR, 'kultury'), { recursive: true })
  fs.mkdirSync(path.join(OUT_DIR, 'problemy'), { recursive: true })

  writePage(path.join(OUT_DIR, 'index.html'), renderShell({
    title: 'Справочник — Календарь дачника',
    description: 'Сроки посадки культур и лечение проблем растений — открытый справочник приложения «Календарь дачника».',
    canonical: `${SITE}/spravochnik/`,
    breadcrumbs: '<a href="/">Главная</a> / Справочник',
    bodyHtml: renderHub()
  }))

  writePage(path.join(OUT_DIR, 'kultury', 'index.html'), renderShell({
    title: 'Справочник культур — когда сажать | Календарь дачника',
    description: 'Сроки посева и высадки, полив и совместимость для 45+ культур — овощи, зелень, ягоды, цветы.',
    canonical: `${SITE}/spravochnik/kultury/`,
    breadcrumbs: '<a href="/">Главная</a> / <a href="/spravochnik/">Справочник</a> / Культуры',
    bodyHtml: renderKulturyIndex(crops)
  }))

  for (const crop of crops) {
    const links = (cropToLinks.get(crop.id) || [])
      .map(l => entriesById.get(l.entry_id))
      .filter(Boolean)
    const dir = path.join(OUT_DIR, 'kultury', crop.slug)
    fs.mkdirSync(dir, { recursive: true })
    writePage(path.join(dir, 'index.html'), renderShell({
      title: buildCropTitle(crop.name),
      description: `${crop.name}: сроки посева и высадки, полив, совместимость с другими культурами. Справочник «Календаря дачника».`,
      canonical: `${SITE}/spravochnik/kultury/${crop.slug}/`,
      breadcrumbs: `<a href="/">Главная</a> / <a href="/spravochnik/">Справочник</a> / <a href="/spravochnik/kultury/">Культуры</a> / ${esc(crop.name)}`,
      bodyHtml: renderCropBody(crop, links),
      jsonLdBlocks: [
        articleJsonLd(crop.name, `${SITE}/spravochnik/kultury/${crop.slug}/`),
        breadcrumbJsonLd([
          { name: 'Главная', url: `${SITE}/` },
          { name: 'Справочник', url: `${SITE}/spravochnik/` },
          { name: 'Культуры', url: `${SITE}/spravochnik/kultury/` },
          { name: crop.name, url: `${SITE}/spravochnik/kultury/${crop.slug}/` }
        ])
      ]
    }))
  }

  writePage(path.join(OUT_DIR, 'problemy', 'index.html'), renderShell({
    title: 'Справочник проблем растений — болезни, вредители, дефициты | Календарь дачника',
    description: 'Признаки, причины и лечение болезней, вредителей и дефицитов микроэлементов у садовых культур.',
    canonical: `${SITE}/spravochnik/problemy/`,
    breadcrumbs: '<a href="/">Главная</a> / <a href="/spravochnik/">Справочник</a> / Проблемы',
    bodyHtml: renderProblemyIndex(entries)
  }))

  for (const entry of entries) {
    const affectedCrops = (entryToLinks.get(entry.id) || [])
      .map(l => ({ crop: cropsById.get(l.crop_id), signs: l.signs, image_url: l.image_url, image_credit: l.image_credit }))
      .filter(l => l.crop)
    const dir = path.join(OUT_DIR, 'problemy', entry.slug)
    fs.mkdirSync(dir, { recursive: true })
    writePage(path.join(dir, 'index.html'), renderShell({
      title: buildEntryTitle(entry.name),
      description: buildEntryDescription(entry),
      canonical: `${SITE}/spravochnik/problemy/${entry.slug}/`,
      breadcrumbs: `<a href="/">Главная</a> / <a href="/spravochnik/">Справочник</a> / <a href="/spravochnik/problemy/">Проблемы</a> / ${esc(entry.name)}`,
      bodyHtml: renderEntryBody(entry, affectedCrops),
      jsonLdBlocks: [
        articleJsonLd(entry.name, `${SITE}/spravochnik/problemy/${entry.slug}/`),
        breadcrumbJsonLd([
          { name: 'Главная', url: `${SITE}/` },
          { name: 'Справочник', url: `${SITE}/spravochnik/` },
          { name: 'Проблемы', url: `${SITE}/spravochnik/problemy/` },
          { name: entry.name, url: `${SITE}/spravochnik/problemy/${entry.slug}/` }
        ])
      ]
    }))
  }

  writeSitemap(crops, entries)

  const expectedFiles = 3 + crops.length + entries.length
  const actualFiles = countHtmlFiles(OUT_DIR)
  if (actualFiles !== expectedFiles) {
    throw new Error(`Ожидалось ${expectedFiles} HTML-файлов, создано ${actualFiles} — проверьте лог выше.`)
  }
  console.log(`Готово: ${actualFiles} страниц в ${OUT_DIR}, sitemap.xml обновлён (${3 + crops.length + entries.length} URL).`)
}

main().catch(e => {
  console.error('Ошибка генерации:', e.message)
  process.exitCode = 1
})
