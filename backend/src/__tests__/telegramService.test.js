'use strict'

const { sendPost, postUrl } = require('../services/telegramService')

describe('telegramService', () => {
  it('sendPost без фото, текст в пределах лимита → sendMessage без каких-либо ссылок сверху', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: 'привет', continueUrl: 'https://vk.com/wall-1_1' }, fetchImpl)
    expect(r).toEqual({ messageId: 42 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendMessage')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', text: 'привет' }) // ссылка не добавляется, если текст и так влез
  })

  it('sendPost с photoUrl и коротким текстом → sendPhoto, caption = body как есть, без ссылок', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: 'подпись', continueUrl: 'https://vk.com/wall-1_1', photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 43 })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendPhoto')
    expect(calls[0].body).toEqual({ chat_id: '@calendacha', photo: 'https://img/x.jpg', caption: 'подпись' })
  })

  it('sendPost с photoUrl и текстом >1024 символов → caption обрезан по границе слова + «Читать полностью: continueUrl»', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 50 } }) }
    }
    const longBody = 'слово '.repeat(200) // 1200 символов
    const continueUrl = 'https://vk.com/wall-1_777'
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: longBody, continueUrl, photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 50 })
    expect(calls).toHaveLength(1) // одно сообщение, не два
    const caption = calls[0].body.caption
    expect(caption.length).toBeLessThanOrEqual(1024)
    expect(caption.endsWith(`Читать полностью: ${continueUrl}`)).toBe(true)
    expect(caption.startsWith('слово слово')).toBe(true) // не обрезано с начала
    expect(caption).toMatch(/слово…\n\nЧитать полностью:/) // обрезано ровно по границе слова, не посередине
  })

  it('sendPost без фото и текстом >4096 символов → sendMessage с обрезкой + «Читать полностью»', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 60 } }) }
    }
    const longBody = 'слово '.repeat(700) // 4200 символов
    const continueUrl = 'https://vk.com/wall-1_999'
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', body: longBody, continueUrl }, fetchImpl)
    expect(r).toEqual({ messageId: 60 })
    const text = calls[0].body.text
    expect(text.length).toBeLessThanOrEqual(4096)
    expect(text.endsWith(`Читать полностью: ${continueUrl}`)).toBe(true)
  })

  it('sendPost пробрасывает ошибку Bot API', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ ok: false, error_code: 403, description: 'bot is not a member' }) })
    await expect(sendPost({ token: 'tok', channelId: '@calendacha', body: 'x', continueUrl: 'https://vk.com/wall-1_1' }, fetchImpl))
      .rejects.toThrow('Telegram sendMessage: 403 bot is not a member')
  })

  it('postUrl строит ссылку на пост в публичном канале', () => {
    expect(postUrl('@calendacha', 42)).toBe('https://t.me/calendacha/42')
  })
})
