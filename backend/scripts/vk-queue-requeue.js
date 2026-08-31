'use strict'

// Разовая утилита: удалить ещё не опубликованные посты из vk_post_queue по диапазону id
// (используется, когда файл-источник поправили ПОСЛЕ первой загрузки, и старые строки нужно
// заменить — vk-queue.js load делает только INSERT, повторная загрузка задублирует посты).
// Использование: node scripts/vk-queue-requeue.js <fromId> <toId>
// Удаляет только status='pending' — уже опубликованные (posted/failed) не трогает.

require('dotenv').config()
const { Pool } = require('pg')

async function main() {
  const [fromId, toId] = process.argv.slice(2).map(Number)
  if (!fromId || !toId) {
    console.error('Использование: node scripts/vk-queue-requeue.js <fromId> <toId>')
    process.exit(1)
  }
  const db = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
  const r = await db.query(
    `DELETE FROM vk_post_queue WHERE id BETWEEN $1 AND $2 AND status = 'pending'`,
    [fromId, toId]
  )
  console.log(`Удалено pending-постов: ${r.rowCount}`)
  await db.end()
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
