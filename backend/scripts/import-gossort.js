'use strict'

/**
 * Выгрузка сырых записей из Госреестра селекционных достижений (gossortrf.ru) по культуре —
 * план docs/superpowers/plans/2026-08-17-crop-varieties.md, шаг A.
 *
 * Сайт не отдаёт JSON/API — только серверный HTML с постраничной пагинацией (Bitrix), поэтому
 * парсим regex'ом по фиксированной разметке карточек (cheerio/jsdom не тянем — разметка простая
 * и стабильная, лишняя зависимость ради неё не нужна).
 *
 * ВАЖНО: это сырьё (код сорта/гибрида, культура, категория, год, патент, лицензии) — БЕЗ дней
 * до урожая (реестр их не хранит) и БЕЗ разделения на «известные сорта» и племенные линии/
 * родительские компоненты. Отбор ≤10-15 сортов на культуру и подтверждение сроков по каталогам
 * оригинаторов — отдельная ручная работа (шаги C/D плана), этот скрипт её не делает.
 *
 * Использование:
 *   node scripts/import-gossort.js "<Культура>" [maxPages]
 *   node scripts/import-gossort.js Морковь 5
 * Без maxPages тянет все страницы (может быть несколько тысяч записей — осторожно).
 * Пишет backend/data/gossort/<slug>.json.
 */

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const { translitToSlug } = require('../src/utils/translit')

const BASE_URL = 'https://gossortrf.ru/registry/gosudarstvennyy-reestr-selektsionnykh-dostizheniy-dopushchennykh-k-ispolzovaniyu-tom-1-sorta-rasteni/'
const OUT_DIR = path.join(__dirname, '..', 'data', 'gossort')
const REQUEST_DELAY_MS = 500 // не долбим сайт подряд

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function pageUrl(culture, page) {
  const qs = new URLSearchParams({ 'arrFilter_pf[CULTURE_NAME]': culture, set_filter: 'Y' })
  if (page > 1) qs.set('PAGEN_1', String(page))
  return `${BASE_URL}?${qs.toString()}`
}

// Каждая карточка — один <a class="registry__results-cards-link" href="...">...</a> с
// name/badge(Культура)/мета-параграфами (Категория/Год включения/Патент/Лицензии — опциональны).
function parseCards(html) {
  const cards = []
  const linkRe = /<a href="([^"]+)" class="registry__results-cards-link">([\s\S]*?)<\/a>/g
  let m
  while ((m = linkRe.exec(html))) {
    const [, href, body] = m
    const name = (body.match(/registry__results-cards-name">([^<]*)</) || [])[1]?.trim()
    const culture = (body.match(/Культура:\s*([^<]*)</) || [])[1]?.trim()
    const category = (body.match(/Категория:\s*([^<]*)</) || [])[1]?.trim() || null
    const year = (body.match(/Год включения:\s*(\d{4})/) || [])[1] || null
    const patent = (body.match(/Патент:\s*([^<]*)</) || [])[1]?.trim() || null
    const licenses = (body.match(/Лицензии:\s*([^<]*)</) || [])[1]?.trim() || null
    if (name && culture) {
      cards.push({ name, culture, category, year: year ? parseInt(year, 10) : null, patent, licenses, url: href })
    }
  }
  return cards
}

function parseTotalPages(html) {
  const total = parseInt((html.match(/Найдено:\s*(\d+)/) || [])[1] || '0', 10)
  const pageNums = Array.from(html.matchAll(/PAGEN_1=(\d+)/g)).map(m => parseInt(m[1], 10))
  const lastPage = pageNums.length ? Math.max(...pageNums) : 1
  return { total, lastPage }
}

async function fetchPage(culture, page) {
  const res = await fetch(pageUrl(culture, page), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DachaCalendarBot/1.0)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} на странице ${page}`)
  return res.text()
}

async function run() {
  const [culture, maxPagesArg] = process.argv.slice(2)
  if (!culture) {
    console.error('Использование: node scripts/import-gossort.js "<Культура>" [maxPages]')
    process.exit(1)
  }
  const maxPages = maxPagesArg ? parseInt(maxPagesArg, 10) : Infinity

  const firstHtml = await fetchPage(culture, 1)
  const { total, lastPage } = parseTotalPages(firstHtml)
  const pagesToFetch = Math.min(lastPage, maxPages)
  console.log(`«${culture}»: найдено ${total} записей, ${lastPage} страниц; тянем ${pagesToFetch}.`)

  const all = parseCards(firstHtml)
  for (let page = 2; page <= pagesToFetch; page++) {
    await sleep(REQUEST_DELAY_MS)
    const html = await fetchPage(culture, page)
    all.push(...parseCards(html))
    if (page % 10 === 0) console.log(`  ...стр. ${page}/${pagesToFetch}`)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outFile = path.join(OUT_DIR, `${translitToSlug(culture)}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ culture, total, fetchedPages: pagesToFetch, fetchedAt: new Date().toISOString(), entries: all }, null, 2), 'utf8')
  console.log(`Записано ${all.length} записей в ${path.relative(process.cwd(), outFile)}`)
}

run().catch(err => { console.error(err); process.exit(1) })
