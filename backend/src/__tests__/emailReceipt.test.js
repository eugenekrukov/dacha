'use strict'

const email = require('../services/emailService')

describe('emailService.sendReceiptLink', () => {
  afterEach(() => { delete process.env.BREVO_API_KEY; delete process.env.UNISENDER_GO_API_KEY; delete process.env.SMTP_HOST; email._resetTransport() })

  it('почта отключена → возвращает false, не бросает', async () => {
    const ok = await email.sendReceiptLink('buyer@mail.ru', 'https://lknpd.nalog.ru/x/print', 'Подписка — 1 месяц', '299.00')
    expect(ok).toBe(false)
  })

  it('экспортируется как функция', () => {
    expect(typeof email.sendReceiptLink).toBe('function')
  })
})
