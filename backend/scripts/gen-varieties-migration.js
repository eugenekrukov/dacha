'use strict'

/**
 * Генерирует SQL-миграцию для crop_varieties из CSV-шорт-листов (docs/varieties/<crop>.csv).
 * SQL на сотни строк руками не пишем — см. план docs/superpowers/plans/2026-08-17-crop-varieties.md,
 * шаг E.
 *
 * Формат CSV (заголовок обязателен, порядок колонок в файле не важен — колонки ищутся по имени):
 *   crop_name,name,ripening,harvest_days,is_hybrid,conditions,notes,source
 * Для многолетников (ягоды/деревья, harvest_days=NULL) вместо дней — окно съёма, две
 * дополнительные колонки (опциональны, если в файле нет — просто NULL):
 *   harvest_doy_start,harvest_doy_end
 * harvest_days, harvest_doy_start, harvest_doy_end, notes могут быть пустыми (→ NULL). source обязателен — без
 * источника строку не заливаем (см. схему 073_crop_varieties.sql).
 *
 * Использование:
 *   node scripts/gen-varieties-migration.js <выходной-файл.sql> <crop1.csv> [crop2.csv ...]
 *   node scripts/gen-varieties-migration.js 076_crop_varieties_batch2.sql morkov.csv svekla.csv
 *
 * Пишет в backend/src/db/migrations/<выходной-файл.sql>. Каждый прогон = отдельный батч
 * культур в свою миграцию (075 — пилот, 076+ — очередные партии); файлы уже применённых
 * культур не трогаем повторно, ON CONFLICT (crop_id, name) DO NOTHING делает файл идемпотентным
 * (миграции этого проекта переигрываются на каждом деплое, см. src/db/migrate.js).
 */

const fs = require('fs')
const path = require('path')

const VARIETIES_DIR = path.join(__dirname, '..', '..', 'docs', 'varieties')
const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations')

// Простой CSV-парсер: поддерживает кавычки "..." с запятыми/кавычками внутри (удвоенные "").
// Полноценной библиотеки не тянем — формат наших CSV фиксированный и небольшой.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function sqlStr(v) {
  if (v === undefined || v === null || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

function sqlInt(v) {
  if (v === undefined || v === null || v === '') return 'NULL'
  return String(parseInt(v, 10))
}

function sqlBool(v) {
  return v === 'true' ? 'true' : 'false'
}

function buildInsert(csvFiles) {
  const values = []
  for (const file of csvFiles) {
    const full = path.join(VARIETIES_DIR, file)
    const rows = parseCsv(fs.readFileSync(full, 'utf8'))
    const [header, ...data] = rows
    const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
    for (const col of ['crop_name', 'name', 'source']) {
      if (idx[col] === undefined) throw new Error(`${file}: отсутствует обязательная колонка "${col}"`)
    }
    for (const r of data) {
      if (!r[idx.crop_name] || !r[idx.name]) continue
      if (!r[idx.source]) throw new Error(`${file}: строка "${r[idx.name]}" без source — не заливаем без источника`)
      values.push(
        `((SELECT id FROM crops WHERE name = ${sqlStr(r[idx.crop_name])}), ` +
        `${sqlStr(r[idx.name])}, ${sqlStr(r[idx.ripening])}, ${sqlInt(r[idx.harvest_days])}, ` +
        `${sqlInt(r[idx.harvest_doy_start])}, ${sqlInt(r[idx.harvest_doy_end])}, ` +
        `${sqlBool(r[idx.is_hybrid])}, ${sqlStr(r[idx.conditions])}, ${sqlStr(r[idx.notes])}, ${sqlStr(r[idx.source])})`
      )
    }
  }
  return values
}

function main() {
  const [outFile, ...csvFiles] = process.argv.slice(2)
  if (!outFile || csvFiles.length === 0) {
    console.error('Использование: node scripts/gen-varieties-migration.js <output.sql> <crop1.csv> [crop2.csv ...]')
    process.exit(1)
  }
  const values = buildInsert(csvFiles)
  if (!values.length) {
    console.error('Ни одной строки не сгенерировано — проверь CSV.')
    process.exit(1)
  }
  const sql = `-- ${outFile}
-- Сгенерировано scripts/gen-varieties-migration.js из docs/varieties/${csvFiles.join(', docs/varieties/')}.
-- Не редактировать руками — поправь исходный CSV и перегенерируй.

INSERT INTO crop_varieties (crop_id, name, ripening, harvest_days, harvest_doy_start, harvest_doy_end, is_hybrid, conditions, notes, source) VALUES
${values.join(',\n')}
ON CONFLICT (crop_id, name) DO NOTHING;
`
  fs.writeFileSync(path.join(MIGRATIONS_DIR, outFile), sql, 'utf8')
  console.log(`Записано ${values.length} строк в src/db/migrations/${outFile}`)
}

main()
