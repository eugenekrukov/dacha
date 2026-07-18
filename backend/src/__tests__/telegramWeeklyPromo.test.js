'use strict'

const { runWeeklyPromo, isEnabled, PROMO_TEXT } = require('../jobs/telegramWeeklyPromoJob')

const ENV = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHANNEL_ID: '@calendacha' }

function fakeTgSvc(messageId = 100) {
  const calls = { sendPost: [] }
  return {
    calls,
    sendPost: async (args) => { calls.sendPost.push(args); return { messageId } },
    postUrl: (chan, id) => `https://t.me/${chan.replace(/^@/, '')}/${id}`
  }
}

describe('telegramWeeklyPromoJob', () => {
  it('isEnabled требует токен и канал', () => {
    expect(isEnabled({})).toBe(false)
    expect(isEnabled(ENV)).toBe(true)
  })

  it('публикует фиксированный промо-текст со ссылкой на лендинг', async () => {
    const tg = fakeTgSvc(100)
    const r = await runWeeklyPromo({ tg, env: ENV })
    expect(r).toEqual({ posted: true, url: 'https://t.me/calendacha/100' })
    expect(tg.calls.sendPost).toEqual([{ token: 'tok', channelId: '@calendacha', body: PROMO_TEXT }])
    expect(PROMO_TEXT).toContain('dacha.studio1008.com')
  })

  it('без env — no-op', async () => {
    const tg = fakeTgSvc()
    const r = await runWeeklyPromo({ tg, env: {} })
    expect(r).toEqual({ posted: false })
    expect(tg.calls.sendPost).toHaveLength(0)
  })
})
