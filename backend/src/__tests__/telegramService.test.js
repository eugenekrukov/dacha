'use strict'

const { sendPost, postUrl } = require('../services/telegramService')

describe('telegramService', () => {
  it('sendPost без фото → sendMessage с body+link', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: 'привет', link: 'https://dacha.studio1008.com' }, fetchImpl)
    expect(r).toEqual({ messageId: 42 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendMessage')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', text: 'привет\n\nhttps://dacha.studio1008.com' })
  })

  it('sendPost с photoUrl и коротким текстом → sendPhoto, caption = body+link одним сообщением', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: 'подпись', link: 'https://dacha.studio1008.com', photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 43 })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendPhoto')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', photo: 'https://img/x.jpg', caption: 'подпись\n\nhttps://dacha.studio1008.com' })
  })

  it('sendPost с photoUrl и текстом >1024 символов → одно sendPhoto, caption обрезан по границе слова, ссылка сохранена целиком', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 50 } }) }
    }
    const longBody = 'слово '.repeat(200) // 1200 символов, с пробелами между словами
    const link = 'https://dacha.studio1008.com'
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: longBody, link, photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 50 })
    expect(calls).toHaveLength(1) // одно сообщение, не два
    const caption = calls[0].body.caption
    expect(caption.length).toBeLessThanOrEqual(1024)
    expect(caption.endsWith(`…\n\n${link}`)).toBe(true) // ссылка сохранена целиком
    expect(caption.startsWith('слово слово')).toBe(true) // не обрезано с начала
    expect(caption).toMatch(/слово…\n\nhttps/) // обрезано ровно по границе слова, не посередине (иначе было бы "сло…")
  })

  it('sendPost пробрасывает ошибку Bot API', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: false, error_code: 403, description: 'bot is not a member' }) })
    await expect(sendPost({ token: 'tok', channelId: '@calendacha', body: 'x', link: 'https://y' }, fetchImpl))
      .rejects.toThrow('Telegram sendMessage: 403 bot is not a member')
  })

  it('postUrl строит ссылку на пост в публичном канале', () => {
    expect(postUrl('@calendacha', 42)).toBe('https://t.me/calendacha/42')
  })
})
