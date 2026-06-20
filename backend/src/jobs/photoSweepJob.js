'use strict'

const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const { DEFAULT_BASE, thumbPath } = require('../services/imageService')

/**
 * Удаляет файлы в каталоге медиа, которым нет соответствия в planting_photos.
 * Thumbnail (_t.webp) считается «известным», если известен его основной файл.
 * Возвращает число удалённых файлов.
 */
async function sweepOrphans(db, { baseDir = DEFAULT_BASE } = {}) {
  const root = path.join(baseDir, 'plantings')
  if (!fs.existsSync(root)) return 0

  const res = await db.query('SELECT file_path FROM planting_photos')
  const known = new Set()
  for (const r of res.rows) { known.add(r.file_path); known.add(thumbPath(r.file_path)) }

  let removed = 0
  for (const plantingDir of fs.readdirSync(root)) {
    const dir = path.join(root, plantingDir)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      const rel = path.posix.join('plantings', plantingDir, f)
      if (!known.has(rel)) { fs.unlinkSync(path.join(dir, f)); removed++ }
    }
  }
  return removed
}

/** Запуск раз в неделю (вс, 04:00). */
function startPhotoSweepJob(db) {
  cron.schedule('0 4 * * 0', () => {
    sweepOrphans(db).then(n => { if (n) console.log(`[photo-sweep] удалено осиротевших файлов: ${n}`) })
      .catch(e => console.error('[photo-sweep] ошибка:', e.message))
  })
}

module.exports = { sweepOrphans, startPhotoSweepJob }
