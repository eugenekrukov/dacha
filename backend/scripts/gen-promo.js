'use strict'

/**
 * Ручная генерация промокодов.
 *
 *   node scripts/gen-promo.js <тип> [count] [--expires=YYYY-MM-DD]
 *
 * Типы:
 *   lifetime        — доступ навсегда
 *   month           — доступ на 30 дней (алиас days 30)
 *   days <N>        — доступ на N дней (N идёт сразу после слова days)
 *
 * Опции:
 *   count           — сколько кодов сгенерировать (позиционный, по умолчанию 1, максимум 1000)
 *   --expires=DATE  — дедлайн АКТИВАЦИИ кода (YYYY-MM-DD). После него код не погасить.
 *
 * Примеры:
 *   node scripts/gen-promo.js lifetime
 *   node scripts/gen-promo.js month 20
 *   node scripts/gen-promo.js days 90 50
 *   node scripts/gen-promo.js days 90 50 --expires=2026-09-01
 *
 * Коды печатаются в stdout (по одному на строку). Использует .env backend
 * (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).
 */

require('dotenv').config()
const crypto = require('crypto')
const { Pool } = require('pg')

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomCode() {
  const bytes = crypto.randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return `DACHA-${s.slice(0, 4)}-${s.slice(4, 8)}`
}

function usage(msg) {
  if (msg) console.error('Ошибка: ' + msg)
  console.error('Usage: node scripts/gen-promo.js <lifetime|month|days N> [count] [--expires=YYYY-MM-DD]')
  process.exit(1)
}

function main() {
  // Разбираем флаги (--expires=...) и позиционные аргументы
  const flags = {}
  const pos = []
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(arg)
    if (m) flags[m[1]] = m[2]
    else pos.push(arg)
  }

  const kind = String(pos[0] || '').toLowerCase()
  let type, durationDays, count

  if (kind === 'lifetime') {
    type = 'lifetime'; durationDays = null; count = parseInt(pos[1] || '1', 10)
  } else if (kind === 'month') {
    type = 'month'; durationDays = 30; count = parseInt(pos[1] || '1', 10)
  } else if (kind === 'days') {
    durationDays = parseInt(pos[1], 10)
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      usage('для типа days укажите число дней 1..3650, напр. days 90')
    }
    type = 'days'; count = parseInt(pos[2] || '1', 10)
  } else {
    usage('неизвестный тип')
  }

  if (!Number.isInteger(count) || count < 1 || count > 1000) usage('count должен быть 1..1000')

  // Дедлайн активации (опционально)
  let expiresAt = null
  if (flags.expires) {
    const d = new Date(flags.expires + 'T23:59:59Z')
    if (isNaN(d.getTime())) usage('--expires должен быть в формате YYYY-MM-DD')
    expiresAt = d.toISOString()
  }

  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'dacha_db',
    user:     process.env.DB_USER     || 'dacha_user',
    password: process.env.DB_PASSWORD || ''
  })

  run(pool, { type, durationDays, count, expiresAt }).catch(e => {
    console.error('Ошибка генерации:', e.message)
    process.exit(1)
  })
}

async function run(pool, { type, durationDays, count, expiresAt }) {
  const created = []
  try {
    for (let i = 0; i < count; i++) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const code = randomCode()
        try {
          await pool.query(
            'INSERT INTO promo_codes (code, type, duration_days, expires_at) VALUES ($1, $2, $3, $4)',
            [code, type, durationDays, expiresAt]
          )
          created.push(code)
          break
        } catch (e) {
          if (e.code === '23505') continue   // коллизия PK — пробуем снова
          throw e
        }
      }
    }
  } finally {
    await pool.end()
  }

  const dur = durationDays == null ? 'навсегда' : `${durationDays} дн.`
  const exp = expiresAt ? `, активировать до ${expiresAt.slice(0, 10)}` : ''
  console.error(`Создано ${created.length} кодов (${type}, доступ: ${dur}${exp}):`)
  created.forEach(c => console.log(c))
}

main()
