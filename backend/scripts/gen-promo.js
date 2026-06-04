'use strict'

/**
 * Ручная генерация промокодов.
 *
 *   node scripts/gen-promo.js <lifetime|month> [count]
 *
 * Примеры:
 *   node scripts/gen-promo.js lifetime        # 1 вечный код
 *   node scripts/gen-promo.js month 20        # 20 месячных кодов
 *
 * Коды печатаются в stdout (по одному на строку) и вставляются в таблицу promo_codes.
 * Использует те же переменные окружения, что и backend (.env): DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.
 */

require('dotenv').config()
const crypto = require('crypto')
const { Pool } = require('pg')

// Алфавит без визуально похожих символов (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomCode() {
  const bytes = crypto.randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return `DACHA-${s.slice(0, 4)}-${s.slice(4, 8)}`
}

async function main() {
  const type = String(process.argv[2] || '').toLowerCase()
  const count = parseInt(process.argv[3] || '1', 10)

  if (type !== 'lifetime' && type !== 'month') {
    console.error('Usage: node scripts/gen-promo.js <lifetime|month> [count]')
    process.exit(1)
  }
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    console.error('Ошибка: count должен быть целым числом 1..1000')
    process.exit(1)
  }

  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'dacha_db',
    user:     process.env.DB_USER     || 'dacha_user',
    password: process.env.DB_PASSWORD || ''
  })

  const created = []
  try {
    for (let i = 0; i < count; i++) {
      // Повторяем при крайне маловероятной коллизии PRIMARY KEY (23505)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const code = randomCode()
        try {
          await pool.query('INSERT INTO promo_codes (code, type) VALUES ($1, $2)', [code, type])
          created.push(code)
          break
        } catch (e) {
          if (e.code === '23505') continue
          throw e
        }
      }
    }
  } finally {
    await pool.end()
  }

  console.error(`Создано ${created.length} кодов (${type}):`)
  created.forEach(c => console.log(c))
}

main().catch(e => {
  console.error('Ошибка генерации:', e.message)
  process.exit(1)
})
