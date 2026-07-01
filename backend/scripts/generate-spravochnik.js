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
