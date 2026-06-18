'use strict'

const nalog = require('../services/nalogService')

describe('nalogService.toMoscowISO', () => {
  it('форматирует UTC в МСК (+03:00)', () => {
    // 2026-06-18T09:00:00Z = 12:00 МСК
    const s = nalog.toMoscowISO(new Date('2026-06-18T09:00:00.000Z'))
    expect(s).toBe('2026-06-18T12:00:00+03:00')
  })
})

describe('nalogService.buildIncomeBody', () => {
  it('формирует тело /income для анонимного чека физлицу', () => {
    const op = new Date('2026-06-18T09:00:00.000Z')
    const body = nalog.buildIncomeBody({
      name: 'Подписка «Календарь дачника» — 1 месяц',
      amount: 299,
      quantity: 1,
      operationTime: op
    })
    expect(body.paymentType).toBe('CASH')
    expect(body.ignoreMaxTotalIncomeRestriction).toBe(false)
    expect(body.client).toEqual({ contactPhone: null, displayName: null, incomeType: 'FROM_INDIVIDUAL', inn: null })
    expect(body.operationTime).toBe('2026-06-18T12:00:00+03:00')
    expect(body.services).toEqual([{ name: 'Подписка «Календарь дачника» — 1 месяц', amount: 299, quantity: 1 }])
    expect(body.totalAmount).toBe('299.00')
    expect(typeof body.requestTime).toBe('string')
  })

  it('totalAmount = amount * quantity с двумя знаками', () => {
    const body = nalog.buildIncomeBody({ name: 'X', amount: 1990, quantity: 1, operationTime: new Date() })
    expect(body.totalAmount).toBe('1990.00')
  })
})
