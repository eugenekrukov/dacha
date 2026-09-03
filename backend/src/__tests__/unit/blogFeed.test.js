'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { getBlogFeedItems, extractLead } = require('../../services/blogFeed')

// Каждый тест — свой временный каталог (манифест + .md), чтобы кэш по mtime не мешал соседям.
function setup({ manifest, contentFile, contentBody }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-feed-'))
  const manifestPath = path.join(dir, '.blog-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8')
  if (contentFile) fs.writeFileSync(path.join(dir, contentFile), contentBody, 'utf8')
  process.env.BLOG_MANIFEST_PATH = manifestPath
  process.env.BLOG_CONTENT_DIR = dir
  return { dir, manifestPath }
}

afterEach(() => {
  delete process.env.BLOG_MANIFEST_PATH
  delete process.env.BLOG_CONTENT_DIR
})

describe('extractLead', () => {
  it('первый абзац, снят жирный', () => {
    const body = '**Первый** абзац текста.\n\nВторой абзац — не входит.'
    expect(extractLead(body)).toBe('Первый абзац текста.')
  })

  it('первый абзац начинается с заголовка секции — снимается разметка заголовка', () => {
    const body = '#### Заголовок секции'
    expect(extractLead(body)).toBe('Заголовок секции')
  })

  it('обрезка по 200 символов на границе слова', () => {
    const body = 'слово '.repeat(50).trim() // 299 символов
    const lead = extractLead(body)
    expect(lead.length).toBeLessThanOrEqual(201) // 200 + «…»
    expect(lead.endsWith('…')).toBe(true)
    expect(lead.endsWith(' …')).toBe(false) // не обрываем слово
  })

  it('пустое тело → null', () => {
    expect(extractLead('')).toBeNull()
    expect(extractLead(null)).toBeNull()
  })
})

describe('getBlogFeedItems', () => {
  it('нет манифеста → пустой список, не падает', () => {
    process.env.BLOG_MANIFEST_PATH = path.join(os.tmpdir(), 'no-such-manifest.json')
    expect(getBlogFeedItems()).toEqual([])
  })

  it('сортировка по scheduledAt ↓, тай-брейк по slug', () => {
    setup({
      manifest: {
        old: { title: 'A', scheduledAt: '2026-01-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' },
        newB: { title: 'B', scheduledAt: '2026-06-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' },
        newA: { title: 'C', scheduledAt: '2026-06-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' }
      }
    })
    const slugs = getBlogFeedItems().map((i) => i.slug)
    expect(slugs).toEqual(['newA', 'newB', 'old'])
  })

  it('посты с датой в будущем не попадают в фид', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    setup({
      manifest: {
        tomorrow: { title: 'Завтра', scheduledAt: future, image: null, sourceFile: 'batch.md' },
        today: { title: 'Сегодня', scheduledAt: '2020-01-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' }
      }
    })
    const slugs = getBlogFeedItems().map((i) => i.slug)
    expect(slugs).toEqual(['today'])
  })

  it('матчит лид по исходному .md через parseContentFile', () => {
    setup({
      manifest: {
        tomaty: { title: 'Чем подкормить томаты', scheduledAt: '2026-01-01T10:00:00+03:00', image: 'https://images.pexels.com/x.jpg', sourceFile: 'batch.md' }
      },
      contentFile: 'batch.md',
      contentBody: '## 2026-01-01 10:00 — Чем подкормить томаты\n\nПервый абзац про подкормку.\n\nВторой абзац.\n'
    })
    const items = getBlogFeedItems()
    expect(items[0]).toMatchObject({
      slug: 'tomaty',
      title: 'Чем подкормить томаты',
      url: 'https://calendacha.ru/blog/tomaty/',
      image: 'https://images.pexels.com/x.jpg',
      lead: 'Первый абзац про подкормку.'
    })
  })

  it('заголовок в манифесте не находит совпадения в .md → lead null, не падает', () => {
    setup({
      manifest: {
        x: { title: 'Старый заголовок', scheduledAt: '2026-01-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' }
      },
      contentFile: 'batch.md',
      contentBody: '## 2026-01-01 10:00 — Новый заголовок\n\nТекст.\n'
    })
    expect(getBlogFeedItems()[0].lead).toBeNull()
  })

  it('пересчитывает при изменении mtime манифеста', () => {
    const { manifestPath } = setup({
      manifest: { a: { title: 'A', scheduledAt: '2026-01-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' } }
    })
    expect(getBlogFeedItems()).toHaveLength(1)

    fs.writeFileSync(manifestPath, JSON.stringify({
      a: { title: 'A', scheduledAt: '2026-01-01T10:00:00+03:00', image: null, sourceFile: 'batch.md' },
      b: { title: 'B', scheduledAt: '2026-01-02T10:00:00+03:00', image: null, sourceFile: 'batch.md' }
    }), 'utf8')
    // Гарантируем другой mtime на файловых системах с грубым разрешением таймера.
    const future = new Date(Date.now() + 2000)
    fs.utimesSync(manifestPath, future, future)

    expect(getBlogFeedItems()).toHaveLength(2)
  })
})
