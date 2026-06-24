'use strict'

const { parseContentFile, queueMessage } = require('../services/vkContent')
const { runVkQueue, isEnabled } = require('../jobs/vkQueueJob')

const ENV = { VK_GROUP_ID: '50', VK_ACCESS_TOKEN: 'tok' }

function fakeDb(dueRows = []) {
  const updates = []
  return {
    updates,
    query: async (sql, args) => {
      if (/SELECT[\s\S]*FROM vk_post_queue/i.test(sql)) return { rows: dueRows }
      if (/^\s*UPDATE vk_post_queue/i.test(sql)) { updates.push({ sql, args }); return { rows: [] } }
      return { rows: [] }
    }
  }
}

function fakeVkSvc(postId = 900) {
  const calls = { postToWall: [], uploadWallPhoto: [] }
  return {
    calls,
    createVk: () => ({}),
    loadImageBytes: async () => Buffer.from('img'),
    uploadWallPhoto: async (_v, gid) => { calls.uploadWallPhoto.push(gid); return { owner_id: -Number(gid), id: 7 } },
    postToWall: async (_v, args) => { calls.postToWall.push(args); return postId },
    postUrl: (gid, id) => `https://vk.com/wall-${Math.abs(Number(gid))}_${id}`
  }
}

describe('vkContent.parseContentFile', () => {
  const SAMPLE = `## 2026-06-25 10:00 — Полив в жару

Поливайте под корень утром.
Вторая строка тела.

Теги: #дача #огород
Картинка: https://img/x.jpg

## 2026-06-26 09:30 — Подкормка

Дайте калий.
Теги: #подкормка`

  it('разбирает посты: дата (МСК), заголовок, тело, теги, картинка', () => {
    const posts = parseContentFile(SAMPLE)
    expect(posts).toHaveLength(2)
    expect(posts[0]).toEqual({
      scheduledAt: '2026-06-25T10:00:00+03:00',
      title: 'Полив в жару',
      body: 'Поливайте под корень утром.\nВторая строка тела.',
      tags: '#дача #огород',
      image: 'https://img/x.jpg'
    })
    expect(posts[1]).toMatchObject({ title: 'Подкормка', tags: '#подкормка', image: null })
    expect(posts[1].body).toBe('Дайте калий.')
  })

  it('queueMessage: тело + теги в конце; без тегов — только тело', () => {
    expect(queueMessage({ body: 'текст', tags: '#дача' })).toBe('текст\n\n#дача')
    expect(queueMessage({ body: 'текст', tags: null })).toBe('текст')
  })
})

describe('vkQueueJob', () => {
  it('isEnabled требует группу и токен', () => {
    expect(isEnabled({})).toBe(false)
    expect(isEnabled(ENV)).toBe(true)
  })

  it('публикует созревший пост (фото + теги) и помечает posted', async () => {
    const db = fakeDb([{ id: 1, body: 'текст', tags: '#дача', image_url: 'https://img/x.jpg', link: 'https://dacha.studio1008.com', attempts: 0 }])
    const vk = fakeVkSvc(900)
    const r = await runVkQueue(db, { vk, fetchImpl: async () => ({}), env: ENV })
    expect(r.posted).toBe(1)
    expect(vk.calls.uploadWallPhoto).toEqual(['50'])
    const post = vk.calls.postToWall[0]
    expect(post.message).toBe('текст\n\n#дача')
    expect(post.link).toBe('https://dacha.studio1008.com')
    const upd = db.updates.find((u) => /status='posted'/.test(u.sql))
    expect(upd.args).toEqual(['https://vk.com/wall-50_900', 1])
  })

  it('нет созревших — ничего не постит', async () => {
    const vk = fakeVkSvc()
    const r = await runVkQueue(fakeDb([]), { vk, fetchImpl: async () => ({}), env: ENV })
    expect(r.posted).toBe(0)
    expect(vk.calls.postToWall).toHaveLength(0)
  })

  it('ошибка постинга на 3-й попытке → status=failed', async () => {
    const db = fakeDb([{ id: 2, body: 'x', tags: null, image_url: null, attempts: 2 }])
    const vk = fakeVkSvc()
    vk.postToWall = async () => { throw new Error('boom') }
    const r = await runVkQueue(db, { vk, fetchImpl: async () => ({}), env: ENV })
    expect(r.failed).toBe(1)
    expect(db.updates[0].args[0]).toBe(3)        // attempts
    expect(db.updates[0].args[2]).toBe('failed') // status
  })

  it('без env — no-op', async () => {
    const vk = fakeVkSvc()
    const r = await runVkQueue(fakeDb([{ id: 1, body: 'x' }]), { vk, env: {} })
    expect(r.posted).toBe(0)
    expect(vk.calls.postToWall).toHaveLength(0)
  })
})
