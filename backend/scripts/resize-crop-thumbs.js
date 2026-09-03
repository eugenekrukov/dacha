#!/usr/bin/env node
'use strict'

/**
 * Генерирует уменьшенные превью фото культур для сетки «Справочника» — карточка там
 * рендерится в ~230px, а исходники с Wikimedia (fetch-crop-images.js) сохранены при 900px
 * шириной (150–300 КБ каждое). При ~67 культурах на одном экране это на дальнем/медленном
 * канале выливается в очень долгую загрузку (грабли 2026-09-03: карточки visibly пустые
 * секундами на связи Сербия→Германия). Полноразмерный оригинал остаётся как есть —
 * используется на детальной странице культуры (CropDetailScreen), там он один, не десятки.
 *
 * Превью — тот же файл, тот же slug, в подпапке thumb/ рядом с оригиналом: URL превью
 * получается из image_url подстановкой /media/crops/ → /media/crops/thumb/ на клиенте,
 * без миграции БД и без нового поля.
 *
 * Запуск: node backend/scripts/resize-crop-thumbs.js
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const SRC_DIR = path.join(__dirname, '..', '..', 'web', 'public', 'media', 'crops')
const OUT_DIR = path.join(SRC_DIR, 'thumb')
const WIDTH = 320   // ~2x карточки в сетке (retina), достаточно для 230px CSS-ширины
const QUALITY = 72

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const files = fs.readdirSync(SRC_DIR).filter(f => /\.jpe?g$/i.test(f))

  let totalBefore = 0
  let totalAfter = 0
  for (const file of files) {
    const src = path.join(SRC_DIR, file)
    const dest = path.join(OUT_DIR, file)
    const before = fs.statSync(src).size
    await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: QUALITY, mozjpeg: true }).toFile(dest)
    const after = fs.statSync(dest).size
    totalBefore += before
    totalAfter += after
    console.log(`${file.padEnd(28)} ${String(Math.round(before / 1024)).padStart(4)} KB → ${String(Math.round(after / 1024)).padStart(3)} KB`)
  }
  console.log(`\nВсего: ${files.length} файлов. ${Math.round(totalBefore / 1024)} KB → ${Math.round(totalAfter / 1024)} KB` +
    ` (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`)
}

main().catch(e => { console.error(e); process.exit(1) })
