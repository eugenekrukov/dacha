'use strict'

const { sendPost, postUrl } = require('../services/telegramService')

describe('telegramService', () => {
  it('sendPost без фото, текст в пределах лимита → sendMessage, HTML, заголовок жирным, без ссылок', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', title: 'Полив в жару', body: 'привет', continueUrl: 'https://vk.com/wall-1_1' }, fetchImpl)
    expect(r).toEqual({ messageId: 42 })
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendMessage')
    expect(calls[0].body).toEqual({
      chat_id: '@calendacha',
      text: '<b>Полив в жару</b>\n\nпривет',
      parse_mode: 'HTML'
    })
  })

  it('sendPost без заголовка → без <b>-обёртки', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    await sendPost({ token: 'tok', channelId: '@calendacha', body: 'привет', continueUrl: 'https://vk.com/wall-1_1' }, fetchImpl)
    expect(calls[0].body.text).toBe('привет')
  })

  it('sendPost экранирует HTML-спецсимволы в теле', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) }
    }
    await sendPost({ token: 'tok', channelId: '@calendacha', title: 'A & B', body: 'x < y & z > 1', continueUrl: 'https://vk.com/wall-1_1' }, fetchImpl)
    expect(calls[0].body.text).toBe('<b>A &amp; B</b>\n\nx &lt; y &amp; z &gt; 1')
  })

  it('sendPost с photoUrl и коротким текстом → sendPhoto, caption с заголовком, без ссылок', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) }
    }
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', title: 'Заголовок', body: 'подпись', continueUrl: 'https://vk.com/wall-1_1', photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 43 })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.telegram.org/bottok/sendPhoto')
    expect(calls[0].body).toEqual({
      chat_id: '@calendacha',
      photo: 'https://img/x.jpg',
      caption: '<b>Заголовок</b>\n\nподпись',
      parse_mode: 'HTML'
    })
  })

  it('sendPost с photoUrl и текстом >1024 символов → caption обрезан по границе слова + кликабельная ссылка "Читать далее в ВК"', async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 50 } }) }
    }
    const longBody = 'слово '.repeat(200) // 1200 символов
    const continueUrl = 'https://vk.com/wall-1_777'
    const r = await sendPost({ token: 'tok', channelId: '@calendacha', title: 'Заголовок', body: longBody, continueUrl, photoUrl: 'https://img/x.jpg' }, fetchImpl)
    expect(r).toEqual({ messageId: 50 })
    expect(calls).toHaveLength(1)
    const caption = calls[0].body.caption
    expect(caption.startsWith('<b>Заголовок</b>\n\nслово слово')).toBe(true)
    expect(caption.endsWith(`…\n\n<a href="${continueUrl}">Читать далее в ВК</a>`)).toBe(true)
    expect(caption).not.toContain('https://vk.com/wall-1_777</a>Читать') // ссылка — это кликабельный текст, не голый URL в видимой части
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
