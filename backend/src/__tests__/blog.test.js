'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const supertest = require('supertest')
const { buildApp } = require('./helpers/buildApp')

function setup(count) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-route-'))
  const manifest = {}
  for (let i = 0; i < count; i++) {
    manifest[`post-${i}`] = {
      title: `Пост ${i}`,
      scheduledAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00+03:00`,
      image: null,
      sourceFile: 'batch.md'
    }
  }
  fs.writeFileSync(path.join(dir, '.blog-manifest.json'), JSON.stringify(manifest), 'utf8')
  process.env.BLOG_MANIFEST_PATH = path.join(dir, '.blog-manifest.json')
  process.env.BLOG_CONTENT_DIR = dir
}

afterEach(() => {
  delete process.env.BLOG_MANIFEST_PATH
  delete process.env.BLOG_CONTENT_DIR
})

describe('GET /blog/feed', () => {
  it('публично, без токена, дефолтный limit=20', async () => {
    setup(3)
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const res = await supertest(app.server).get('/blog/feed')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(3)
    await app.close()
  })

  it('limit/offset режут страницу, total — от полного списка', async () => {
    setup(5)
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const res = await supertest(app.server).get('/blog/feed?limit=2&offset=2')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(5)
    expect(res.body.items).toHaveLength(2)
    await app.close()
  })

  it('нет манифеста → пустой список, не 500', async () => {
    process.env.BLOG_MANIFEST_PATH = path.join(os.tmpdir(), 'no-such-manifest.json')
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const res = await supertest(app.server).get('/blog/feed')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], total: 0 })
    await app.close()
  })
})
