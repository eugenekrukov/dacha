'use strict'

/**
 * Отправляет все URL из landing/sitemap.xml в IndexNow (Яндекс/Bing и другие участники протокола
 * получают уведомление через один запрос — см. https://www.indexnow.org/documentation).
 *
 *   node scripts/submit-indexnow.js
 *
 * Требует INDEXNOW_KEY в .env backend и уже выложенный на сайте файл {INDEXNOW_KEY}.txt
 * (см. docs/DEPLOY.md, раздел IndexNow) — без файла-подтверждения Яндекс вернёт 403.
 * Гонять после каждой перегенерации /spravochnik/, если появились новые/удалённые страницы —
 * протокол просит сообщать только об изменениях, но при первом подключении и при заметных
 * партиях новых страниц отправка всего sitemap — обычная практика.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const SITE_HOST = 'dacha.studio1008.com'
const SITEMAP_PATH = path.join(__dirname, '..', '..', 'landing', 'sitemap.xml')
const ENDPOINT = 'https://yandex.com/indexnow'

function extractUrls(sitemapXml) {
  const matches = sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)
  return [...matches].map(m => m[1])
}

async function main() {
  const key = process.env.INDEXNOW_KEY
  if (!key) {
    console.error('INDEXNOW_KEY не задан в .env')
    process.exitCode = 1
    return
  }

  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8')
  const urlList = extractUrls(xml)
  if (!urlList.length) {
    console.error('В sitemap.xml не найдено ни одного <loc> — нечего отправлять')
    process.exitCode = 1
    return
  }

  const body = {
    host: SITE_HOST,
    key,
    keyLocation: `https://${SITE_HOST}/${key}.txt`,
    urlList
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  })

  const text = await res.text()
  console.log(`${res.status} ${res.statusText}`)
  if (text) console.log(text)
  console.log(`Отправлено URL: ${urlList.length}`)

  if (res.status !== 200 && res.status !== 202) {
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error('Ошибка отправки в IndexNow:', e.message)
  process.exitCode = 1
})
