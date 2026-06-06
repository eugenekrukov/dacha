'use strict'

const yk = require('../services/yookassaService')

describe('yookassaService.buildReceipt', () => {
  const plan = yk.getPlan('monthly')

  afterEach(() => { delete process.env.YOOKASSA_RECEIPT_MODE })

  it('по умолчанию формирует чек с email покупателя и vat_code=1 (без НДС, самозанятый)', () => {
    const r = yk.buildReceipt('buyer@mail.ru', plan)
    expect(r).not.toBeNull()
    expect(r.customer.email).toBe('buyer@mail.ru')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].vat_code).toBe(1)
    expect(r.items[0].payment_subject).toBe('service')
    expect(r.items[0].amount.value).toBe('299.00')
  })

  it('YOOKASSA_RECEIPT_MODE=off → чек не формируется (null)', () => {
    process.env.YOOKASSA_RECEIPT_MODE = 'off'
    expect(yk.buildReceipt('buyer@mail.ru', plan)).toBeNull()
  })

  it('YOOKASSA_RECEIPT_MODE=on → чек формируется', () => {
    process.env.YOOKASSA_RECEIPT_MODE = 'on'
    expect(yk.buildReceipt('buyer@mail.ru', plan)).not.toBeNull()
  })
})

describe('yookassaService.getPlan', () => {
  it('возвращает тарифы monthly/yearly и null для неизвестного', () => {
    expect(yk.getPlan('monthly').amount).toBe('299.00')
    expect(yk.getPlan('yearly').amount).toBe('1990.00')
    expect(yk.getPlan('weekly')).toBeNull()
  })
})

describe('yookassaService.isEnabled', () => {
  afterEach(() => { delete process.env.YOOKASSA_SHOP_ID; delete process.env.YOOKASSA_SECRET_KEY })

  it('off без ключей', () => {
    expect(yk.isEnabled()).toBe(false)
  })

  it('on при заданных ключах', () => {
    process.env.YOOKASSA_SHOP_ID = '123'
    process.env.YOOKASSA_SECRET_KEY = 'secret'
    expect(yk.isEnabled()).toBe(true)
  })
})
