'use strict'

// Управление очередью автопостинга ВК.
//   node scripts/vk-queue.js load <file.md> [--dry]   — загрузить посты из файла в очередь
//   node scripts/vk-queue.js list                      — показать очередь
//
// Формат файла — см. src/services/vkContent.js. Ссылку для всех постов берёт из
// VK_POST_LINK (по умолчанию https://dacha.studio1008.com). Публикует их фоновый
// джоб jobs/vkQueueJob.js по расписанию scheduled_at.

require('dotenv').config()
const fs = require('fs')
const { Pool } = require('pg')
const { parseContentFile } = require('../src/services/vkContent')

const LINK = process.env.VK_POST_LINK || 'https://dacha.studio1008.com'

function pool() {
  return new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
}

async function load(file, dry) {
  const md = fs.readFileSync(file, 'utf8')
  const posts = parseContentFile(md)
  if (posts.length === 0) {
    console.error('Посты не найдены. Формат заголовка: "## YYYY-MM-DD HH:MM — Заголовок"')
    process.exit(1)
  }
  // Предупреждаем о «## »-блоках, которые не распознались (неверная дата/время/разделитель) —
  // чтобы пост не выпал из загрузки молча.
  const headerCount = (md.match(/^## /gm) || []).length
  if (posts.length < headerCount) {
    console.warn(`⚠ Распознано ${posts.length} из ${headerCount} блоков "## " — проверьте формат заголовков (дата, время, тире).`)
  }
  if (dry) {
    posts.forEach((p) => console.log(`${p.scheduledAt}  ${p.title}  [фото:${p.image ? 'да' : 'нет'}] [${p.tags || 'без тегов'}]`))
    console.log(`\n[dry] распознано постов: ${posts.length} (в БД не записаны)`)
    return
  }
  const db = pool()
  let n = 0
  for (const p of posts) {
    await db.query(
      `INSERT INTO vk_post_queue (scheduled_at, title, body, tags, image_url, link)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [p.scheduledAt, p.title, p.body, p.tags, p.image, LINK]
    )
    n++
  }
  await db.end()
  console.log(`В очередь добавлено постов: ${n}`)
}

async function list() {
  const db = pool()
  const r = await db.query(
    `SELECT id, to_char(scheduled_at, 'YYYY-MM-DD HH24:MI') AS at, status, left(title, 44) AS title, vk_post_url
       FROM vk_post_queue ORDER BY scheduled_at`
  )
  for (const row of r.rows) {
    console.log(`#${row.id} ${row.at} [${row.status}] ${row.title}${row.vk_post_url ? ' → ' + row.vk_post_url : ''}`)
  }
  console.log(`Всего в очереди: ${r.rows.length}`)
  await db.end()
}

async function main() {
  const [cmd, arg] = process.argv.slice(2)
  const dry = process.argv.includes('--dry')
  if (cmd === 'load' && arg) return load(arg, dry)
  if (cmd === 'list') return list()
  console.log('Использование:\n  node scripts/vk-queue.js load <file.md> [--dry]\n  node scripts/vk-queue.js list')
  process.exit(cmd ? 1 : 0)
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
