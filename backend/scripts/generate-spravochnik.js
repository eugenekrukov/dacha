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
    .map(block => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
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
