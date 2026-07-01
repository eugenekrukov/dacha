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
