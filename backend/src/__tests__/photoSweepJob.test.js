'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { sweepOrphans } = require('../jobs/photoSweepJob')

describe('photoSweepJob.sweepOrphans', () => {
  it('удаляет файлы, которых нет в БД; известные оставляет', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-'))
    const known = path.join(dir, 'plantings', '5'); fs.mkdirSync(known, { recursive: true })
    fs.writeFileSync(path.join(known, 'keep.webp'), 'x')
    fs.writeFileSync(path.join(known, 'orphan.webp'), 'x')
    const db = { async query() { return { rows: [{ file_path: 'plantings/5/keep.webp' }] } } }

    const removed = await sweepOrphans(db, { baseDir: dir })
    expect(fs.existsSync(path.join(known, 'keep.webp'))).toBe(true)
    expect(fs.existsSync(path.join(known, 'orphan.webp'))).toBe(false)
    expect(removed).toBe(1)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
