'use strict'

const { queueMessage } = require('../services/vkContent')
const { runTelegramQueue, isEnabled } = require('../jobs/telegramQueueJob')

const ENV = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '@calendacha' }

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

function fakeTgSvc(messageId = 42) {
  const calls = { sendPost: [] }
  return {
    calls,
    sendPost: async (args) => { calls.sendPost.push(args); return { messageId } },
    postUrl: (chan, id) => `https://t.me/${chan.replace(/^@/, '')}/${id}`
  }
}

describe('telegramQueueJob', () => {
  it('isEnabled требует токен и канал', () => {
    expect(isEnabled({})).toBe(false)
    expect(isEnabled(ENV)).toBe(true)
  })

  it('публикует созревший пост (фото + теги) и помечает telegram_status=posted', async () => {
    const db = fakeDb([{ id: 1, body: 'текст', tags: '#дача', image_url: 'https://img/x.jpg', link: 'https://dacha.studio1008.com', telegram_attempts: 0 }])
    const tg = fakeTgSvc(42)
    const r = await runTelegramQueue(db, { tg, env: ENV })
    expect(r.posted).toBe(1)
    const call = tg.calls.sendPost[0]
    expect(call.body).toBe(queueMessage({ body: 'текст', tags: '#дача' }))
    expect(call.link).toBe('https://dacha.studio1008.com')
    expect(call.photoUrl).toBe('https://img/x.jpg')
    const upd = db.updates.find((u) => /telegram_status='posted'/.test(u.sql))
    expect(upd.args).toEqual(['https://t.me/calendacha/42', 1])
  })

  it('нет созревших — ничего не постит', async () => {
    const tg = fakeTgSvc()
    const r = await runTelegramQueue(fakeDb([]), { tg, env: ENV })
    expect(r.posted).toBe(0)
    expect(tg.calls.sendPost).toHaveLength(0)
  })

  it('ошибка постинга на 3-й попытке → telegram_status=failed', async () => {
    const db = fakeDb([{ id: 2, body: 'x', tags: null, image_url: null, telegram_attempts: 2 }])
    const tg = fakeTgSvc()
    tg.sendPost = async () => { throw new Error('boom') }
    const r = await runTelegramQueue(db, { tg, env: ENV })
    expect(r.failed).toBe(1)
    expect(db.updates[0].args[0]).toBe(3)        // telegram_attempts
    expect(db.updates[0].args[2]).toBe('failed') // telegram_status
  })

  it('без env — no-op', async () => {
    const tg = fakeTgSvc()
    const r = await runTelegramQueue(fakeDb([{ id: 1, body: 'x' }]), { tg, env: {} })
    expect(r.posted).toBe(0)
    expect(tg.calls.sendPost).toHaveLength(0)
  })
})
