'use strict'

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// На Windows sharp/libvips держит файловые дескрипторы в кэше, из-за чего
// временные директории не удаляются сразу после записи (EPERM при rmSync).
// Отключаем файловый кэш — он не нужен в нашем сценарии (по одному файлу на фото).
sharp.cache(false)

const DEFAULT_BASE = process.env.MEDIA_DIR || '/var/www/dacha-media'
const MAX_EDGE = 1600
const THUMB_EDGE = 400
const QUALITY = 80

function thumbPath(filePath) {
  return filePath.replace(/\.webp$/, '_t.webp')
}

/**
 * Обработать загруженное фото: авто-ориентация, resize 1600px, webp q80, thumbnail 400px,
 * срез всего EXIF (включая GPS). Дату съёмки берём из EXIF DateTimeOriginal до среза.
 * Возвращает { file_path (относительный), width, height, bytes, taken_at|null }.
 */
async function processImage(buffer, { plantingId, baseDir = DEFAULT_BASE }) {
  const rel = path.posix.join('plantings', String(plantingId), `${crypto.randomUUID()}.webp`)
  const full = path.join(baseDir, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })

  let takenAt = null
  try {
    const meta = await sharp(buffer).metadata()
    if (meta.exif) {
      const m = meta.exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
      if (m) takenAt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`)
    }
  } catch { /* нет EXIF — не критично */ }

  const out = await sharp(buffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true })

  fs.writeFileSync(full, out.data)

  await sharp(buffer)
    .rotate()
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(path.join(baseDir, thumbPath(rel)))

  return {
    file_path: rel,
    width: out.info.width,
    height: out.info.height,
    bytes: out.info.size,
    taken_at: takenAt
  }
}

/** Удалить основной файл и thumbnail (идемпотентно). */
async function remove(relPath, { baseDir = DEFAULT_BASE } = {}) {
  for (const p of [relPath, thumbPath(relPath)]) {
    try { fs.unlinkSync(path.join(baseDir, p)) } catch { /* уже нет — ок */ }
  }
}

module.exports = { process: processImage, remove, thumbPath, DEFAULT_BASE }
