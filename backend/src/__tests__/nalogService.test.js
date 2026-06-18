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

describe('nalogService.isEnabled', () => {
  afterEach(() => { delete process.env.NALOG_INN; delete process.env.NALOG_PROXY_URL })

  it('off без ключей', () => {
    expect(nalog.isEnabled()).toBe(false)
  })
  it('on при NALOG_INN + NALOG_PROXY_URL', () => {
    process.env.NALOG_INN = '123456789012'
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    expect(nalog.isEnabled()).toBe(true)
  })
})

describe('nalogService.addIncome / cancelIncome (с инъекцией fetch)', () => {
  afterEach(() => { delete process.env.NALOG_PROXY_URL; nalog._resetToken() })

  function makeDb(refreshToken = 'rt_1') {
    return {
      updates: [],
      async query(sql, params) {
        if (sql.includes('SELECT refresh_token FROM nalog_auth')) {
          return { rows: [{ refresh_token: refreshToken }] }
        }
        if (sql.includes('UPDATE nalog_auth SET refresh_token')) {
          this.updates.push(params)
          return { rows: [] }
        }
        throw new Error('Неожиданный SQL: ' + sql)
      }
    }
  }

  it('addIncome: получает токен, постит /income, возвращает approvedReceiptUuid', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const calls = []
    const fakeFetch = async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) })
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc_1', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/income')) {
        return { ok: true, status: 200, json: async () => ({ approvedReceiptUuid: 'rcpt_abc' }) }
      }
      throw new Error('unexpected url ' + url)
    }
    const uuid = await nalog.addIncome(makeDb(), {
      name: 'Подписка', amount: 299, quantity: 1, operationTime: new Date('2026-06-18T09:00:00Z')
    }, fakeFetch)
    expect(uuid).toBe('rcpt_abc')
    expect(calls[0].url).toContain('/auth/token')
    expect(calls[0].body.refreshToken).toBe('rt_1')
    expect(calls[1].url).toContain('/income')
    expect(calls[1].body.totalAmount).toBe('299.00')
  })

  it('addIncome: на 401 обновляет токен и повторяет запрос один раз', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    let incomeCalls = 0
    const fakeFetch = async (url) => {
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/income')) {
        incomeCalls++
        if (incomeCalls === 1) return { ok: false, status: 401, json: async () => ({ message: 'unauthorized' }) }
        return { ok: true, status: 200, json: async () => ({ approvedReceiptUuid: 'rcpt_retry' }) }
      }
      throw new Error('unexpected url ' + url)
    }
    const uuid = await nalog.addIncome(makeDb(), { name: 'X', amount: 1, quantity: 1, operationTime: new Date() }, fakeFetch)
    expect(uuid).toBe('rcpt_retry')
    expect(incomeCalls).toBe(2)
  })

  it('addIncome: нет refresh_token → ошибка с подсказкой про bootstrap', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const db = { async query() { return { rows: [{ refresh_token: null }] } } }
    await expect(
      nalog.addIncome(db, { name: 'X', amount: 1, quantity: 1, operationTime: new Date() }, async () => {})
    ).rejects.toThrow(/nalog-auth/)
  })

  it('cancelIncome: постит /cancel с receiptUuid и причиной', async () => {
    process.env.NALOG_PROXY_URL = 'http://ru-proxy:3128'
    const calls = []
    const fakeFetch = async (url, opts) => {
      if (url.endsWith('/auth/token')) {
        return { ok: true, status: 200, json: async () => ({ token: 'acc', tokenExpireIn: '2099-01-01T00:00:00Z' }) }
      }
      if (url.endsWith('/cancel')) {
        calls.push(JSON.parse(opts.body))
        return { ok: true, status: 200, json: async () => ({ incomeInfo: {} }) }
      }
      throw new Error('unexpected url ' + url)
    }
    await nalog.cancelIncome(makeDb(), 'rcpt_abc', 'REFUND', fakeFetch)
    expect(calls[0].receiptUuid).toBe('rcpt_abc')
    expect(calls[0].comment).toBe('REFUND')
  })
})

describe('nalogService.getReceiptUrl', () => {
  afterEach(() => { delete process.env.NALOG_INN })
  it('строит ссылку на печать чека по ИНН и uuid', () => {
    process.env.NALOG_INN = '123456789012'
    expect(nalog.getReceiptUrl('rcpt_abc'))
      .toBe('https://lknpd.nalog.ru/api/v1/receipt/123456789012/rcpt_abc/print')
  })
})
