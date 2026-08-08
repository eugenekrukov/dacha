#!/usr/bin/env node
'use strict'

/**
 * Подбор фото культур с Wikimedia Commons — зеркало того, как заливались фото справочника
 * (миграции 034/035/039/049): файл `web/public/media/crops/<slug>.jpg` + `image_url`/`image_credit`
 * в БД, атрибуция «Автор, Лицензия, Wikimedia Commons».
 *
 * Источник кадра — ведущее фото статьи Википедии (`prop=pageimages`), а не поиск по Commons:
 * поиск по научному названию тащит гербарные листы, микрофото, схемы и сканы каталогов семян
 * XIX века, а ведущее фото статьи курируется людьми и почти всегда показывает растение/плод
 * целиком. Лицензия и автор берутся из Commons (`iiprop=extmetadata`) — не выдумываются.
 *
 * Скрипт НИЧЕГО не пишет в БД: он только качает файлы и печатает готовый SQL для миграции,
 * чтобы фото можно было глазами проверить до деплоя.
 *
 * Запуск:  node backend/scripts/fetch-crop-images.js [slug ...]           — культуры (CROPS)
 *          node backend/scripts/fetch-crop-images.js --guide [slug ...]  — справочник (GUIDE)
 *          (без списка slug — все записи набора)
 */

const fs = require('fs')
const path = require('path')

// Wikimedia требует содержательный User-Agent, иначе режет запросы.
const UA = 'DachaKalendar/1.0 (https://dacha.studio1008.com; dacha@studio1008.com) node-fetch'
const MEDIA_ROOT = path.join(__dirname, '..', '..', 'web', 'public', 'media')
const WIDTH = 900   // одинаково для культур и справочника
const PAUSE_MS = 300

// slug → откуда брать кадр.
//   wiki   — статья Википедии (en предсказуемее по заголовкам; ru — когда у en ведущее фото
//            неподходящее, например ботаническая гравюра Köhler вместо фотоснимка)
//   search — фолбэк: поиск по Commons, когда у статьи нет ведущего фото или оно несвободное
//   category — видовая категория Commons (+ prefer: подстрока в имени файла). Самый надёжный
//              путь для «трудных» культур: в категории лежат фотографии вида, а не сканы книг
//   file   — конкретный файл Commons («File:...»). Для записей справочника, где кадр подобран
//            вручную: болезнь надо показать ту самую, случайный снимок рода вводит в заблуждение
const CROPS = {
  // овощи
  tomat:                  { wiki: 'en', title: 'Tomato' },
  ogurec:                 { wiki: 'en', title: 'Cucumber' },
  perec:                  { wiki: 'en', title: 'Bell pepper' },
  'perec-ostryy':         { wiki: 'en', title: 'Chili pepper' },
  baklazhan:              { wiki: 'en', title: 'Eggplant' },
  // Ведущее фото Zucchini — макро кожуры; нужен плод целиком.
  kabachok:               { category: 'Category:Zucchini (squash)', prefer: 'zucchini|courgette' },
  patisson:               { wiki: 'en', title: 'Pattypan squash' },
  tykva:                  { wiki: 'en', title: 'Pumpkin' },
  kartofel:               { wiki: 'en', title: 'Potato' },
  morkov:                 { wiki: 'en', title: 'Carrot' },
  svekla:                 { wiki: 'en', title: 'Beetroot' },
  redis:                  { wiki: 'en', title: 'Radish' },
  redka:                  { search: 'black radish' },
  repa:                   { wiki: 'en', title: 'Turnip' },
  // Ведущее фото Parsnip — семена; поиск даёт тощий дикий корень. Нужен пищевой корнеплод.
  pasternak:              { category: 'Category:Pastinaca sativa roots', prefer: 'parsnip' },
  hren:                   { wiki: 'en', title: 'Horseradish' },
  reven:                  { wiki: 'en', title: 'Rhubarb' },
  selderey:               { wiki: 'en', title: 'Celery' },
  // Ведущие фото статей Cabbage/Broccoli/Green bean/Parsley/Apple — под GFDL 1.2 (Evan-Amos),
  // а GFDL требует таскать полный текст лицензии рядом с изображением. Берём CC-аналоги.
  // ru: дикая цветущая капуста, поиск отдаёт разрез краснокочанной. Нужен белый кочан.
  // f. alba — именно белокочанная («Category:Cabbage» смешивает пекинскую и блюда из неё).
  'kapusta-belokochannaya': { category: 'Category:Brassica oleracea var. capitata f. alba', prefer: 'kohl|cabbage|capitata' },
  'kapusta-brokkoli':     { search: 'Brassica oleracea italica broccoli head' },
  'kapusta-cvetnaya':     { wiki: 'en', title: 'Cauliflower' },
  'kapusta-pekinskaya':   { wiki: 'en', title: 'Napa cabbage' },
  'luk-repchatyy':        { wiki: 'en', title: 'Onion' },
  'luk-porey':            { wiki: 'en', title: 'Leek' },
  'luk-batun':            { wiki: 'en', title: 'Allium fistulosum' },
  // Ведущее фото Garlic — гравюра, поиск тоже даёт гравюры. Берём из видовой категории.
  chesnok:                { category: 'Category:Allium sativum', prefer: 'bulb|garlic' },
  goroh:                  { wiki: 'en', title: 'Pea' },
  'fasol-struchkovaya':   { search: 'Phaseolus vulgaris green beans harvest pods' },
  // Ведущее фото статьи Maize — гравюра Köhler (1897), а поиск тащит сканы каталогов семян
  // XIX века («No restrictions» с Flickr Commons). Русская статья даёт фотоснимок.
  kukuruza:               { wiki: 'ru', title: 'Кукуруза' },
  'salat-listovoy':       { wiki: 'en', title: 'Lettuce' },
  shpinat:                { wiki: 'en', title: 'Spinach' },
  schavel:                { wiki: 'en', title: 'Sorrel' },
  // зелень и травы
  ukrop:                  { wiki: 'ru', title: 'Укроп пахучий' },
  petrushka:              { search: 'Petroselinum crispum parsley leaves plant' },
  bazilik:                { wiki: 'en', title: 'Basil' },
  kinza:                  { search: 'Coriandrum sativum cilantro leaves plant' },
  myata:                  { wiki: 'en', title: 'Mentha' },
  timyan:                 { category: 'Category:Thymus vulgaris', prefer: 'thymus vulgaris' },
  // ягоды и бахча
  klubnika:               { wiki: 'en', title: 'Strawberry' },
  arbuz:                  { wiki: 'en', title: 'Watermelon' },
  dynya:                  { search: 'Cucumis melo cantaloupe melon fruit whole' },
  // кустарники
  // Ведущее фото Raspberry — макро-разрез одной ягоды; нужны ягоды на кусте.
  malina:                 { category: 'Category:Rubus idaeus', prefer: 'fruit|berr|ripe|frucht' },
  ezhevika:               { wiki: 'en', title: 'Blackberry' },
  kryzhovnik:             { wiki: 'en', title: 'Gooseberry' },
  'smorodina-chernaya':   { wiki: 'en', title: 'Blackcurrant' },
  'smorodina-krasnaya':   { search: 'Ribes rubrum fruit' },
  'smorodina-belaya':     { search: 'Ribes rubrum white currant fruit' },
  'zhimolost-sedobnaya':  { wiki: 'en', title: 'Lonicera caerulea' },
  // деревья
  yablonya:               { search: 'Malus domestica apples on tree orchard' },
  grusha:                 { wiki: 'en', title: 'Pear' },
  // en:Prunus cerasus — гравюра Köhler, ru:«Вишня обыкновенная» — цветение. Нужны ягоды.
  vishnya:                { search: 'Prunus cerasus fruit' },
  chereshnya:             { wiki: 'en', title: 'Cherry' },
  sliva:                  { wiki: 'en', title: 'Plum' },
  // цветы
  barhatcy:               { wiki: 'en', title: 'Tagetes' },
  petuniya:               { wiki: 'en', title: 'Petunia' },
}

// Записи справочника проблем (guide_entries). Кадры подобраны и сверены вручную: для болезни
// важно показать именно её, поэтому здесь только явные `file`, без поиска «на удачу».
const GUIDE = {
  'uglovataya-pyatnistost-bakterioz': { file: 'File:Angular leaf spot of cucumber 5359665.jpg' },
  'fomopsis-suhaya-gnil':             { file: 'File:Eggplant phomopsis 1 (5815759324).jpg' },
  'boron-deficiency':                 { file: 'File:Endivien Bormangel, Hinrichs-Berger, Jan, LTZ Augustenberg.jpg' },
}

// Что заливаем: культуры (по умолчанию) или записи справочника (--guide).
const TARGETS = {
  crops: { dir: 'crops', table: 'crops',         items: CROPS },
  guide: { dir: 'guide', table: 'guide_entries', items: GUIDE },
}

// Свободные лицензии, которые пускаем. Всё остальное (fair use, GFDL, «No restrictions»,
// пустая лицензия) — пропускаем: фото показывается публично в приложении и на сайте.
// GFDL отсеиваем сознательно — она требует прикладывать полный текст лицензии к изображению.
const FREE_LICENSE_RE = /^(cc0|cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?|public domain|pd(-|$)|attribution)/i

async function api(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`)
  return res.json()
}

/** Ведущее фото статьи Википедии → имя файла на Commons (File:...). */
async function leadImageFile(lang, title) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}&redirects=1`
  const data = await api(url)
  const page = data?.query?.pages?.[0]
  if (!page || page.missing) throw new Error(`нет статьи ${lang}:${title}`)
  if (!page.pageimage) throw new Error(`у статьи ${lang}:${title} нет ведущего фото`)
  return `File:${page.pageimage}`
}

// Мусор в выдаче Commons: сканы каталогов семян и книг XIX–начала XX века (заливались с Flickr
// Commons пачками, поэтому забивают топ), гравюры и гербарные листы. Для карточки культуры
// нужен фотоснимок, поэтому такие заголовки отбрасываем.
const JUNK_TITLE_RE = /\((1[6-9]\d\d|20\d\d)\)|illustration|k[oö]hler|herbari|drawing|engrav|plate|catalog|nurser|seed (list|annual)|price list|report|magazine|journal|botanical/i

/**
 * Фолбэк: лучший файл из поиска по Commons.
 * Берём широкую выдачу и отсеиваем сканы книг/гравюры — иначе в топе оказываются
 * «Childs' seeds that satisfy (1920)» и подобные, которые формально свободны, но бесполезны.
 */
async function searchFile(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
    `&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(query)}`
  const data = await api(url)
  const pages = (data?.query?.pages || [])
    .filter(p => /\.(jpe?g)$/i.test(p.title))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))   // сохраняем порядок релевантности

  const clean = pages.filter(p => !JUNK_TITLE_RE.test(p.title))
  const pick = clean[0] || pages[0]
  if (!pick) throw new Error(`поиск Commons ничего не дал: ${query}`)
  return pick.title
}

/**
 * Файлы из категории Commons. Видовые категории («Category:Allium sativum») — это ровно
 * фотографии вида, без сканов каталогов, поэтому для «трудных» культур это надёжнее поиска.
 * `prefer` — подстрока в имени файла, которой отдаём предпочтение (например 'bulb').
 */
async function categoryFile(category, prefer) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
    `&generator=categorymembers&gcmtype=file&gcmlimit=200&gcmtitle=${encodeURIComponent(category)}`
  const data = await api(url)
  const files = (data?.query?.pages || [])
    .map(p => p.title)
    .filter(t => /\.(jpe?g)$/i.test(t) && !JUNK_TITLE_RE.test(t))
  if (!files.length) throw new Error(`в категории нет подходящих файлов: ${category}`)
  if (prefer) {
    const re = new RegExp(prefer, 'i')
    const hit = files.find(t => re.test(t))
    if (hit) return hit
  }
  return files[0]
}

/** Метаданные файла на Commons: URL превью нужной ширины, автор, лицензия. */
async function fileInfo(fileTitle) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2' +
    `&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}`
  const data = await api(url)
  const info = data?.query?.pages?.[0]?.imageinfo?.[0]
  if (!info) throw new Error(`нет imageinfo для ${fileTitle}`)
  const meta = info.extmetadata || {}
  return {
    url: info.thumburl || info.url,
    descriptionUrl: info.descriptionurl,
    author: cleanHtml(meta.Artist?.value) || 'Wikimedia Commons',
    license: (meta.LicenseShortName?.value || '').trim(),
  }
}

// Artist приходит HTML-ом (ссылки, span-ы) — вытаскиваем читаемое имя.
function cleanHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} при скачивании`)
  const type = res.headers.get('content-type') || ''
  if (!type.startsWith('image/')) throw new Error(`не картинка: content-type=${type}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  return buf.length
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const sqlEscape = s => String(s).replace(/'/g, "''")

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--guide') ? 'guide' : 'crops'
  const target = TARGETS[mode]
  const OUT_DIR = path.join(MEDIA_ROOT, target.dir)

  const only = args.filter(a => a !== '--guide')
  const slugs = only.length ? only : Object.keys(target.items)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const done = []
  const failed = []

  for (const slug of slugs) {
    const cfg = target.items[slug]
    if (!cfg) { failed.push([slug, `нет в конфиге (${mode})`]); continue }
    try {
      const fileTitle = cfg.file
        ? cfg.file
        : cfg.category
          ? await categoryFile(cfg.category, cfg.prefer)
          : cfg.search
            ? await searchFile(cfg.search)
            : await leadImageFile(cfg.wiki || 'en', cfg.title)

      const info = await fileInfo(fileTitle)

      if (!FREE_LICENSE_RE.test(info.license)) {
        failed.push([slug, `несвободная/неизвестная лицензия: "${info.license}" (${fileTitle})`])
        continue
      }

      const dest = path.join(OUT_DIR, `${slug}.jpg`)
      const bytes = await download(info.url, dest)
      // Если автор на Commons не указан, кредит без него — иначе выходит
      // «Wikimedia Commons, CC BY-SA 3.0, Wikimedia Commons».
      const credit = info.author === 'Wikimedia Commons'
        ? `${info.license}, Wikimedia Commons`
        : `${info.author}, ${info.license}, Wikimedia Commons`

      done.push({ slug, credit, bytes, fileTitle, descriptionUrl: info.descriptionUrl })
      console.log(`OK ${slug.padEnd(24)} ${String(Math.round(bytes / 1024)).padStart(4)} KB  ${info.license.padEnd(14)} ${info.author}`)
    } catch (e) {
      failed.push([slug, e.message])
      console.error(`-- ${slug.padEnd(24)} ${e.message}`)
    }
    await sleep(PAUSE_MS)
  }

  console.log(`\nГотово: ${done.length} скачано, ${failed.length} не вышло.`)
  if (failed.length) {
    console.log('\nНе вышло (подобрать вручную):')
    failed.forEach(([slug, why]) => console.log(`  ${slug}: ${why}`))
  }

  // Источники — чтобы проверить лицензию по ссылке, не перезапуская скрипт.
  // Копится между запусками: скрипт часто гоняют по одному slug.
  const srcPath = path.join(__dirname, `${mode}-images.sources.json`)
  const prev = fs.existsSync(srcPath) ? JSON.parse(fs.readFileSync(srcPath, 'utf8')) : []
  const merged = [...prev.filter(p => !done.some(d => d.slug === p.slug)), ...done]
    .sort((a, b) => a.slug.localeCompare(b.slug))
  fs.writeFileSync(srcPath, JSON.stringify(merged, null, 2) + '\n')

  // Готовый SQL — вставить в миграцию после визуальной проверки кадров.
  const sqlPath = path.join(__dirname, `${mode}-images.generated.sql`)
  const sql = merged.map(d =>
    `UPDATE ${target.table} SET image_url='https://dacha.studio1008.com/app/media/${target.dir}/${d.slug}.jpg', ` +
    `image_credit='${sqlEscape(d.credit)}' WHERE slug='${d.slug}';`
  ).join('\n')
  fs.writeFileSync(sqlPath, sql + '\n')
  console.log(`\nВсего в наборе (${mode}): ${merged.length}. SQL: ${sqlPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
