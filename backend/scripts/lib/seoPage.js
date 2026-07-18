'use strict'

/**
 * Общие хелперы для генераторов статических SEO-страниц лендинга
 * (generate-spravochnik.js, generate-blog.js): HTML-шаблон, JSON-LD, sitemap.xml.
 *
 * Вынесено 2026-07-18, когда появился второй генератор (блог) — до этого жило
 * только внутри generate-spravochnik.js.
 */

const fs = require('fs')

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function writePage(filePath, html) {
  fs.writeFileSync(filePath, html, 'utf8')
}

function countHtmlFiles(dir) {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = require('path').join(dir, entry.name)
    if (entry.isDirectory()) count += countHtmlFiles(full)
    else if (entry.name.endsWith('.html')) count += 1
  }
  return count
}

function articleJsonLd(name, url, extra = {}) {
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
    },
    ...extra
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

function renderShell({ title, description, canonical, breadcrumbs, bodyHtml, jsonLdBlocks, stylesheet }) {
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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Календарь дачника">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${stylesheet || '/spravochnik/assets/style.css'}">
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

// --- sitemap.xml: слияние без взаимного затирания между генераторами ---

function parseSitemapUrls(xml) {
  if (!xml) return []
  const urls = []
  const re = /<url>\s*<loc>([\s\S]*?)<\/loc>\s*<lastmod>([\s\S]*?)<\/lastmod>\s*<changefreq>([\s\S]*?)<\/changefreq>\s*<priority>([\s\S]*?)<\/priority>\s*<\/url>/g
  let m
  while ((m = re.exec(xml))) {
    urls.push({ loc: m[1], lastmod: m[2], freq: m[3], priority: m[4] })
  }
  return urls
}

function renderSitemap(urls) {
  const body = urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
}

/**
 * Мердж sitemap.xml между несколькими независимыми генераторами: каждый знает только
 * свою зону (isOwned(loc)) и не трогает записи остальных. Без этого второй генератор,
 * перезаписывающий файл целиком, тихо стирал бы URL первого при следующем запуске.
 */
function mergeSitemapUrls(sitemapPath, isOwned, freshUrls) {
  const today = new Date().toISOString().slice(0, 10)
  const existingXml = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : ''
  const kept = parseSitemapUrls(existingXml).filter(u => !isOwned(u.loc))
  const fresh = freshUrls.map(u => ({ loc: u.loc, lastmod: today, freq: u.freq, priority: u.priority }))
  fs.writeFileSync(sitemapPath, renderSitemap([...kept, ...fresh]), 'utf8')
}

module.exports = {
  esc, writePage, countHtmlFiles, articleJsonLd, breadcrumbJsonLd, renderShell, mergeSitemapUrls
}
