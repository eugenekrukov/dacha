'use strict'

const { sendPost, postUrl } = require('../services/telegramService')

describe('telegramService', () => {
  it('sendPost без фото → sendMessage с text', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', text: 'привет' }, fetchImpl)
    expect(r).toEqual({ messageId: 42 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendMessage')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', text: 'привет' })
  })

  it('sendPost с photoUrl → sendPhoto с caption', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', text: 'подпись', photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 43 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendPhoto')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', photo: 'https://img/x.jpg', caption: 'подпись' })
  })

  it('sendPost пробрасывает ошибку Bot API', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: false, error_code: 403, description: 'bot is not a member' }) })
    await expect(sendPost({ token: 'tok', channelId: '@calendacha', text: 'x' }, fetchImpl))
      .rejects.toThrow('Telegram sendMessage: 403 bot is not a member')
  })

  it('postUrl строит ссылку на пост в публичном канале', () => {
    expect(postUrl('@calendacha', 42)).toBe('https://t.me/calendacha/42')
  })
})
