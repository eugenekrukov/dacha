'use strict'

/**
 * Инварианты данных crop_varieties (план docs/superpowers/plans/2026-08-17-crop-varieties.md,
 * раздел «Проверки»):
 *   1. У каждой строки с harvest_days заполнен source (гарантируется схемой NOT NULL — здесь
 *      просто перепроверяем, что source не пустая строка).
 *   2. harvest_days сорта не меньше transplant_days культуры (иначе урожай раньше высадки рассады).
 *   3. У культур category='fruit' (плодовые) заполнено окно (harvest_doy_start/end),
 *      а не harvest_days — это многолетники, для них дни от посадки бессмысленны.
 *
 * Запуск (с заполненным .env — нужен доступ к БД):
 *   node scripts/check-varieties-invariants.js
 * Код возврата 1 при первом же нарушении, 0 если всё чисто.
 */

require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

async function run() {
  const { rows } = await pool.query(
    `SELECT v.id, v.name AS variety_name, v.harvest_days, v.harvest_doy_start, v.harvest_doy_end,
            v.source, c.name AS crop_name, c.category, c.transplant_days
     FROM crop_varieties v JOIN crops c ON c.id = v.crop_id`
  )

  const problems = []
  for (const r of rows) {
    if (r.harvest_days != null && (!r.source || !r.source.trim())) {
      problems.push(`#${r.id} ${r.crop_name}/${r.variety_name}: harvest_days=${r.harvest_days} без source`)
    }
    if (r.harvest_days != null && r.transplant_days != null && r.harvest_days < r.transplant_days) {
      problems.push(`#${r.id} ${r.crop_name}/${r.variety_name}: harvest_days=${r.harvest_days} < transplant_days культуры=${r.transplant_days}`)
    }
    if (r.category === 'fruit' && r.harvest_days != null) {
      problems.push(`#${r.id} ${r.crop_name}/${r.variety_name}: плодовая культура, но заполнены harvest_days вместо окна harvest_doy_*`)
    }
  }

  if (problems.length) {
    console.error(`Найдено нарушений: ${problems.length}`)
    problems.forEach(p => console.error('  - ' + p))
    process.exitCode = 1
  } else {
    console.log(`Проверено ${rows.length} строк crop_varieties — нарушений нет.`)
  }
  await pool.end()
}

run()
