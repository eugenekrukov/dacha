'use strict'

const sharp = require('sharp')
const fs = require('fs')
const os = require('os')
const path = require('path')
const imageService = require('../services/imageService')

describe('imageService', () => {
  let dir
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgsvc-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  async function makeJpeg(w, h) {
    return sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 120, b: 30 } } })
      .jpeg().toBuffer()
  }

  it('resize до 1600px, webp, thumbnail, метаданные', async () => {
    const input = await makeJpeg(3000, 2000)
    const res = await imageService.process(input, { plantingId: 7, baseDir: dir })
    const full = path.join(dir, res.file_path)
    expect(fs.existsSync(full)).toBe(true)
    const meta = await sharp(full).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1600)
    expect(res.width).toBe(meta.width)
    expect(res.height).toBe(meta.height)
    expect(res.bytes).toBeGreaterThan(0)
    const thumb = full.replace(/\.webp$/, '_t.webp')
    expect(fs.existsSync(thumb)).toBe(true)
    const tmeta = await sharp(thumb).metadata()
    expect(Math.max(tmeta.width, tmeta.height)).toBeLessThanOrEqual(400)
  })

  it('маленькое фото не увеличивается', async () => {
    const input = await makeJpeg(500, 400)
    const res = await imageService.process(input, { plantingId: 1, baseDir: dir })
    expect(res.width).toBe(500)
    expect(res.height).toBe(400)
  })

  it('remove удаляет основной файл и thumbnail', async () => {
    const input = await makeJpeg(800, 600)
    const res = await imageService.process(input, { plantingId: 2, baseDir: dir })
    await imageService.remove(res.file_path, { baseDir: dir })
    expect(fs.existsSync(path.join(dir, res.file_path))).toBe(false)
    expect(fs.existsSync(path.join(dir, res.file_path.replace(/\.webp$/, '_t.webp')))).toBe(false)
  })
})
