# Spravochnik SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate static, indexable SEO pages at `/spravochnik/` on `dacha.studio1008.com`, built from the existing public `/crops` and `/guide` API data (crop planting info + plant-problem guide with photos), to capture long-tail informational search traffic.

**Architecture:** Static site generation (SSG). A one-off Node script queries Postgres directly (same pattern as `backend/scripts/gen-promo.js`) and writes plain HTML files into `landing/spravochnik/`, deployed the same way the existing `landing/index.html` is deployed (copy to `/var/www/dacha-landing` on the VPS). No changes to the Fastify JSON API or runtime behavior.

**Tech Stack:** Node.js (`pg` for DB access, no new dependencies), plain HTML/CSS (no templating library, consistent with the hand-authored `landing/index.html`), Vitest for the two pure-function utilities.

**Design doc:** `docs/superpowers/specs/2026-07-01-spravochnik-seo-pages-design.md`

**Scope note:** This plan covers writing and locally verifying the code. It does **not** include running the migration/generator against the production database, copying files to the VPS, or editing the production nginx config — those are separate, explicitly-approved deploy actions (Task 11 documents the steps but does not execute them against prod).

---

### Task 1: Transliteration utility (RU → slug)

**Files:**
- Create: `backend/src/utils/translit.js`
- Test: `backend/src/__tests__/translit.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
'use strict'

const { describe, it, expect } = require('vitest')
const { translitToSlug } = require('../utils/translit')

describe('translitToSlug', () => {
  it('converts a simple crop name', () => {
    expect(translitToSlug('Томат')).toBe('tomat')
  })

  it('converts multi-word names with spaces to hyphens', () => {
    expect(translitToSlug('Капуста пекинская')).toBe('kapusta-pekinskaya')
  })

  it('handles ъ and ь as empty (no latin equivalent)', () => {
    expect(translitToSlug('Объект-подъезд')).toBe('obekt-podezd')
  })

  it('collapses repeated separators and trims edges', () => {
    expect(translitToSlug('  Лук — репчатый!!  ')).toBe('luk-repchatyy')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run src/__tests__/translit.test.js`
Expected: FAIL — `Cannot find module '../utils/translit'`

- [ ] **Step 3: Write the implementation**

```javascript
'use strict'

// Простая транслитерация RU→latin для стабильных URL-slug'ов (см.
// docs/superpowers/specs/2026-07-01-spravochnik-seo-pages-design.md).
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

function translitToSlug(text) {
  const lower = String(text).toLowerCase()
  let out = ''
  for (const ch of lower) {
    out += MAP[ch] !== undefined ? MAP[ch] : ch
  }
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

module.exports = { translitToSlug }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/translit.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/translit.js backend/src/__tests__/translit.test.js
git commit -m "feat(spravochnik): add RU-to-slug transliteration utility"
```

---

### Task 2: Day-of-year → human date label utility

**Files:**
- Create: `backend/src/utils/dayOfYear.js`
- Test: `backend/src/__tests__/dayOfYear.test.js`

`crops.sowing_start_day`/`sowing_end_day` are stored as day-of-year integers (1–365). Content pages need them as "20 марта", not raw numbers.

- [ ] **Step 1: Write the failing tests**

```javascript
'use strict'

const { describe, it, expect } = require('vitest')
const { dayOfYearToDateLabel } = require('../utils/dayOfYear')

describe('dayOfYearToDateLabel', () => {
  it('returns 1 января for day 1', () => {
    expect(dayOfYearToDateLabel(1)).toBe('1 января')
  })

  it('returns 1 марта for day 60 (non-leap reference year)', () => {
    expect(dayOfYearToDateLabel(60)).toBe('1 марта')
  })

  it('returns 31 декабря for day 365', () => {
    expect(dayOfYearToDateLabel(365)).toBe('31 декабря')
  })

  it('clamps values above 365', () => {
    expect(dayOfYearToDateLabel(400)).toBe('31 декабря')
  })

  it('clamps values below 1', () => {
    expect(dayOfYearToDateLabel(0)).toBe('1 января')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/dayOfYear.test.js`
Expected: FAIL — `Cannot find module '../utils/dayOfYear'`

- [ ] **Step 3: Write the implementation**

```javascript
'use strict'

// Отображение "день года" → человекочитаемая дата. Не учитывает високосный год —
// используется только для показа диапазона посева на страницах /spravochnik/,
// не для расчётов (расчёты сроков остаются в recommendations.js как есть).
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function dayOfYearToDateLabel(day) {
  let remaining = Math.max(1, Math.min(365, Math.round(day)))
  for (let month = 0; month < 12; month++) {
    if (remaining <= DAYS_IN_MONTH[month]) {
      return `${remaining} ${MONTH_NAMES[month]}`
    }
    remaining -= DAYS_IN_MONTH[month]
  }
  return `31 ${MONTH_NAMES[11]}`
}

module.exports = { dayOfYearToDateLabel }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/dayOfYear.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/dayOfYear.js backend/src/__tests__/dayOfYear.test.js
git commit -m "feat(spravochnik): add day-of-year to date label utility"
```

---

### Task 3: Migration — `crops.slug` column

**Files:**
- Create: `backend/src/db/migrations/056_crops_slug.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 056_crops_slug.sql
-- Стабильный slug для публичных SEO-страниц /spravochnik/kultury/{slug}/.
-- Заполняется одноразовым скриптом backend/scripts/backfill-crop-slugs.js, НЕ этой
-- миграцией (транслитерация — JS-логика, не переносится в чистый SQL). Миграции
-- перезапускаются на каждом деплое (см. src/db/migrate.js) — ALTER идемпотентен.

ALTER TABLE crops ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
```

- [ ] **Step 2: Run the migration against your local DB**

Run (from `backend/`): `npm run migrate`
Expected: `✅ 056_crops_slug.sql` in the output, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/056_crops_slug.sql
git commit -m "feat(spravochnik): add crops.slug column for stable content-page URLs"
```

---

### Task 4: Backfill script for `crops.slug`

**Files:**
- Create: `backend/scripts/backfill-crop-slugs.js`

- [ ] **Step 1: Write the script**

```javascript
'use strict'

/**
 * Одноразовое заполнение crops.slug транслитерацией из name — для стабильных
 * URL страниц /spravochnik/kultury/{slug}/. Идемпотентен: трогает только
 * строки с slug IS NULL, при коллизии добавляет числовой суффикс.
 *
 *   node scripts/backfill-crop-slugs.js
 *
 * Использует .env backend (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).
 */

require('dotenv').config()
const { Pool } = require('pg')
const { translitToSlug } = require('../src/utils/translit')

async function run(pool) {
  const { rows } = await pool.query('SELECT id, name FROM crops WHERE slug IS NULL ORDER BY id ASC')
  if (!rows.length) {
    console.log('Все культуры уже имеют slug — нечего заполнять.')
    return
  }

  const { rows: existing } = await pool.query('SELECT slug FROM crops WHERE slug IS NOT NULL')
  const taken = new Set(existing.map(r => r.slug))

  for (const crop of rows) {
    const base = translitToSlug(crop.name) || `crop-${crop.id}`
    let slug = base
    let suffix = 2
    while (taken.has(slug)) {
      slug = `${base}-${suffix}`
      suffix++
    }
    taken.add(slug)
    await pool.query('UPDATE crops SET slug = $1 WHERE id = $2', [slug, crop.id])
    console.log(`#${crop.id} ${crop.name} → ${slug}`)
  }

  console.log(`Готово: заполнено ${rows.length} slug.`)
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'dacha_db',
  user: process.env.DB_USER || 'dacha_user',
  password: process.env.DB_PASSWORD || ''
})

run(pool)
  .catch(e => {
    console.error('Ошибка бэкфилла:', e.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
```

- [ ] **Step 2: Run it against your local DB**

Run (from `backend/`): `node scripts/backfill-crop-slugs.js`
Expected: one line per crop (`#1 Томат → tomat`, …), ending with `Готово: заполнено N slug.`

- [ ] **Step 3: Verify uniqueness and coverage**

Run: `node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool();p.query('SELECT count(*) total, count(distinct slug) distinct_slugs, count(*) filter (where slug is null) nulls FROM crops').then(r=>{console.log(r.rows[0]);p.end()})"`
Expected: `total === distinct_slugs` and `nulls: 0`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/backfill-crop-slugs.js
git commit -m "feat(spravochnik): add one-time crop slug backfill script"
```

---

### Task 5: Shared stylesheet for `/spravochnik/` pages

**Files:**
- Create: `landing/spravochnik/assets/style.css`

Hand-authored, not generated — one file, cached by the browser across all ~120 pages instead of inlining the same CSS in every file (unlike `landing/index.html`, which is a single page and inlines its CSS for a zero-extra-request load).

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "landing/spravochnik/assets"
```

```css
:root{
  --orange:#FF7B00; --orange-deep:#E85700; --amber:#FFB347;
  --cream:#FFF8EB; --cream-2:#FFEFD8; --paper:#FFFFFF;
  --green:#2E7D32; --ink:#3A2615; --muted:#8A6D52; --line:#F0DFC4;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Nunito',system-ui,sans-serif;color:var(--ink);line-height:1.6;background:var(--cream)}
a{color:var(--orange-deep);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:900px;margin:0 auto;padding:0 22px}
h1,h2,h3{font-family:'Nunito',sans-serif;font-weight:900;letter-spacing:-.5px}
header{background:rgba(255,248,235,.9);border-bottom:1px solid var(--line);padding:16px 0}
.brand{font-weight:900;font-size:18px;color:var(--ink)}
.breadcrumbs{font-size:13px;font-weight:700;color:var(--muted);margin:20px 0}
.breadcrumbs a{color:var(--muted)}
.breadcrumbs a:hover{color:var(--orange-deep)}
main{padding:20px 0 60px}
h1{font-size:clamp(26px,4vw,38px);margin-bottom:10px;color:var(--ink)}
.badge{display:inline-block;background:var(--cream-2);color:var(--orange-deep);font-weight:800;
  font-size:12px;text-transform:uppercase;letter-spacing:.5px;padding:4px 12px;border-radius:100px;margin:0 8px 8px 0}
.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:22px;margin:16px 0}
.card h2{font-size:18px;margin-bottom:8px;color:var(--ink)}
.card p{font-size:15px;color:#4a3a2a;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:20px 0}
.grid a{display:block;background:var(--paper);border:1px solid var(--line);border-radius:14px;
  padding:14px 16px;font-weight:800;color:var(--ink)}
.grid a:hover{border-color:var(--orange);text-decoration:none}
.photo{max-width:100%;border-radius:14px;margin:14px 0 4px;display:block}
.photo-credit{font-size:12px;color:var(--muted);margin-bottom:16px}
.cta{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:16px;
  padding:14px 24px;border-radius:16px;background:linear-gradient(180deg,var(--amber),var(--orange));
  color:#fff;margin:24px 0}
.cta:hover{text-decoration:none;opacity:.92}
.related{margin-top:24px}
.related h2{font-size:16px;margin-bottom:10px}
.related ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.related li a{display:inline-block;background:var(--cream-2);color:var(--orange-deep);font-weight:700;
  font-size:13.5px;padding:6px 14px;border-radius:100px}
.related li a:hover{background:var(--orange);color:#fff;text-decoration:none}
footer{padding:30px 0;text-align:center;color:var(--muted);font-weight:700;font-size:13px}
```

- [ ] **Step 2: Commit**

```bash
git add landing/spravochnik/assets/style.css
git commit -m "feat(spravochnik): add shared stylesheet for content pages"
```

---

### Task 6: Generator script — data loading, helpers, page shell

**Files:**
- Create: `backend/scripts/generate-spravochnik.js`

- [ ] **Step 1: Write the file header, constants, and small helpers**

```javascript
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
```

- [ ] **Step 2: Append the page shell template**

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/generate-spravochnik.js
git commit -m "feat(spravochnik): add generator script skeleton with page shell"
```

---

### Task 7: Generator script — content templates

**Files:**
- Modify: `backend/scripts/generate-spravochnik.js` (append below the code from Task 6)

- [ ] **Step 1: Append the hub and index-page templates**

```javascript
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
```

- [ ] **Step 2: Append the crop detail template**

```javascript
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
```

- [ ] **Step 3: Append the problem detail template (with images, per owner's request)**

```javascript
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
```

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/generate-spravochnik.js
git commit -m "feat(spravochnik): add hub, index, and detail page templates"
```

---

### Task 8: Generator script — orchestration, sitemap, self-check

**Files:**
- Modify: `backend/scripts/generate-spravochnik.js` (append below the code from Task 7)

- [ ] **Step 1: Append the sitemap writer**

```javascript
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
```

- [ ] **Step 2: Append `main()` — data loading, collision checks, file writing, self-check**

```javascript
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
  const entriesById = new Map(entries.map(e => [e.id, e]))
  const cropToLinks = new Map()
  const entryToLinks = new Map()
  for (const link of linksRes.rows) {
    if (!cropToLinks.has(link.crop_id)) cropToLinks.set(link.crop_id, [])
    cropToLinks.get(link.crop_id).push(link)
    if (!entryToLinks.has(link.entry_id)) entryToLinks.set(link.entry_id, [])
    entryToLinks.get(link.entry_id).push(link)
  }

  // чистая пересборка каталога
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
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
      title: `${crop.name} — когда сажать и как ухаживать | Календарь дачника`,
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
      title: `${entry.name} — признаки и лечение | Календарь дачника`,
      description: `${entry.name}: как распознать и что делать. ${(entry.description || '').slice(0, 100)}`,
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
```

- [ ] **Step 3: Run the generator against your local DB**

Run (from `backend/`): `node scripts/generate-spravochnik.js`
Expected: no warnings about missing slugs (Task 4 already backfilled them), ends with `Готово: N страниц в .../landing/spravochnik, sitemap.xml обновлён (...)`.

- [ ] **Step 4: Spot-check the output on disk**

Run: `ls "landing/spravochnik/kultury" | head -5` and open one generated file, e.g. `landing/spravochnik/kultury/tomat/index.html`, to confirm it's a complete HTML document with the crop's actual data filled in (not empty fields).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/generate-spravochnik.js landing/spravochnik landing/sitemap.xml
git commit -m "feat(spravochnik): generate static content pages and sitemap"
```

---

### Task 9: Link `/spravochnik/` from the landing page

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 1: Add a nav link**

Find (in the `<nav class="nav-links">` block):

```html
      <a href="#legal">Документы</a>
      <a href="#contacts">Контакты</a>
```

Replace with:

```html
      <a href="/spravochnik/">Справочник</a>
      <a href="#legal">Документы</a>
      <a href="#contacts">Контакты</a>
```

- [ ] **Step 2: Add a footer link**

Find (in the legal `.store-row` in the footer):

```html
    <div class="store-row" style="margin-top:4px">
      <a class="store" href="/offer">Оферта</a>
```

Replace with:

```html
    <div class="store-row" style="margin-top:4px">
      <a class="store" href="/spravochnik/">Справочник</a>
      <a class="store" href="/offer">Оферта</a>
```

- [ ] **Step 3: Verify in the preview**

Start the `dacha-landing` preview config (already defined in `.claude/launch.json`, port 8777) and check the nav/footer render the new link. The `/spravochnik/` link itself will 404 in this preview since it only serves `landing/`'s existing files at the time of preview — that's expected until Task 8's generated output is present in the same served directory (it will be, since Task 8 writes into `landing/spravochnik/`).

- [ ] **Step 4: Commit**

```bash
git add landing/index.html
git commit -m "feat(spravochnik): link the content hub from landing nav and footer"
```

---

### Task 10: Nginx location block (documentation only — do not apply to prod in this task)

**Files:**
- Modify: `docs/DEPLOY.md`

- [ ] **Step 1: Add generation + deploy instructions to the "Лендинг (отдельно!)" section**

Find:

```markdown
## Лендинг (отдельно!)

`/var/www/dacha-landing` не обновляется деплоем `dacha-api`. После правок `landing/*`:
```powershell
ssh hetzner 'cp /var/www/dacha-api/landing/index.html /var/www/dacha-landing/index.html && cp /var/www/dacha-api/landing/return.html /var/www/dacha-landing/return.html'
```
Если правили `offer.html` или `privacy.html` — скопировать и их (команда выше их не трогает), а также
**синхронизировать дублирующий текст в аккордеоне `#legal` внутри `index.html`** — см. `landing/README.md`.
```

Replace with:

```markdown
## Лендинг (отдельно!)

`/var/www/dacha-landing` не обновляется деплоем `dacha-api`. После правок `landing/*`:
```powershell
ssh hetzner 'cp /var/www/dacha-api/landing/index.html /var/www/dacha-landing/index.html && cp /var/www/dacha-api/landing/return.html /var/www/dacha-landing/return.html'
```
Если правили `offer.html` или `privacy.html` — скопировать и их (команда выше их не трогает), а также
**синхронизировать дублирующий текст в аккордеоне `#legal` внутри `index.html`** — см. `landing/README.md`.

### Справочник `/spravochnik/` (SEO-страницы культур и проблем растений)

Генерируется скриптом из БД, не редактируется руками. После изменения данных
культур/справочника (или при первом деплое фичи):

```powershell
ssh hetzner 'cd /var/www/dacha-api/backend && node scripts/backfill-crop-slugs.js && node scripts/generate-spravochnik.js'
ssh hetzner 'rm -rf /var/www/dacha-landing/spravochnik && cp -r /var/www/dacha-api/landing/spravochnik /var/www/dacha-landing/spravochnik && cp /var/www/dacha-api/landing/sitemap.xml /var/www/dacha-landing/sitemap.xml'
```

Требуется миграция `056_crops_slug.sql` (накатывается обычным деплоем `dacha-api`,
см. выше в этом файле) и один новый location-блок в nginx-конфиге сайта
(`/etc/nginx/sites-available/dacha`), добавить ПЕРЕД проксирующим `location /`:

```nginx
location /spravochnik/ {
    root /var/www/dacha-landing;
    try_files $uri $uri/ =404;
}
```

Затем `sudo nginx -t && sudo systemctl reload nginx`. Location-блок нужен один раз,
дальше только перегенерация содержимого.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: document /spravochnik/ generation and deploy steps"
```

---

### Task 11: Local end-to-end verification (no production changes)

**Files:** none (verification only)

- [ ] **Step 1: Run the full local sequence from scratch**

Run (from `backend/`):
```bash
npm run migrate
node scripts/backfill-crop-slugs.js
node scripts/generate-spravochnik.js
npx vitest run
```
Expected: migration reports `056_crops_slug.sql` applied (or already applied), backfill reports crops filled, generator reports `Готово: N страниц`, and the full vitest suite passes (398+ tests, plus the new `translit`/`dayOfYear` tests from Tasks 1–2).

- [ ] **Step 2: Preview a sample of each page type in the browser**

Using the existing `dacha-landing` preview config (`.claude/launch.json`, port 8777, serves `landing/`):
- `/spravochnik/` — hub links to both sections
- `/spravochnik/kultury/tomat/` (or any generated crop slug) — sowing dates render as text like "с 20 марта по 10 апреля", companion crops link out, CTA links to `/app/`
- `/spravochnik/problemy/` — pick one entry with a photo and one without; confirm the photo + `image_credit` caption render for the one that has `image_url`, and the other renders cleanly with no broken `<img>` tag
- View source on one detail page — confirm `<title>`, meta description, canonical, and the `application/ld+json` block are all populated with real content, not empty strings

- [ ] **Step 3: Confirm nothing outside `landing/` and `backend/` changed unexpectedly**

Run: `git status`
Expected: only files from Tasks 1–10 are modified/new — no unrelated files touched.

This task produces no commit — it's a verification checkpoint before deciding to deploy (deploying to `dacha.studio1008.com` production, including the nginx change from Task 10, is a separate, explicitly-approved action outside this plan).
