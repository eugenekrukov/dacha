'use strict'

const { runRenewals } = require('../jobs/renewalJob')

const PLANS = {
  monthly: { amount: '299.00', days: 30 },
  yearly:  { amount: '1990.00', days: 365 }
}

function makeYk({ enabled = true, charge } = {}) {
  return {
    isEnabled: () => enabled,
    getPlan: (p) => PLANS[p] || null,
    chargeRecurring: charge || (async (user) => ({ id: `pay_${user.id}`, status: 'pending' }))
  }
}

function makeMockDb(candidates) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      if (sql.includes('FROM users u') && sql.includes('auto_renew')) {
        return { rows: candidates }
      }
      if (sql.includes('INSERT INTO payments')) {
        inserted.push(params)
        return { rows: [] }
      }
      throw new Error('Неожиданный SQL в моке: ' + sql)
    }
  }
}

describe('runRenewals (автопродление)', () => {
  it('списывает по сохранённой карте подходящих пользователей и пишет pending-платёж', async () => {
    const db = makeMockDb([
      { id: 1, email: 'a@b.c', plan: 'monthly', payment_method_id: 'pm_1' },
      { id: 2, email: 'd@e.f', plan: 'yearly',  payment_method_id: 'pm_2' }
    ])
    await runRenewals(db, makeYk())
    expect(db.inserted.length).toBe(2)
    // params: [user.id, payment.id, status, amount, plan]
    expect(db.inserted[0][1]).toBe('pay_1')
    expect(db.inserted[0][4]).toBe('monthly')
    expect(db.inserted[1][4]).toBe('yearly')
  })

  it('биллинг отключён → ничего не списывает', async () => {
    const db = makeMockDb([{ id: 1, email: 'a@b.c', plan: 'monthly', payment_method_id: 'pm_1' }])
    await runRenewals(db, makeYk({ enabled: false }))
    expect(db.inserted.length).toBe(0)
  })

  it('нет кандидатов → no-op', async () => {
    const db = makeMockDb([])
    await runRenewals(db, makeYk())
    expect(db.inserted.length).toBe(0)
  })

  it('ошибка списания одного пользователя не ломает остальных', async () => {
    let calls = 0
    const charge = async (user) => {
      calls++
      if (user.id === 1) throw new Error('карта отклонена')
      return { id: `pay_${user.id}`, status: 'pending' }
    }
    const db = makeMockDb([
      { id: 1, email: 'a@b.c', plan: 'monthly', payment_method_id: 'pm_1' },
      { id: 2, email: 'd@e.f', plan: 'monthly', payment_method_id: 'pm_2' }
    ])
    await runRenewals(db, makeYk({ charge }))
    expect(calls).toBe(2)               // обоих попробовали
    expect(db.inserted.length).toBe(1)  // записан только успешный
    expect(db.inserted[0][1]).toBe('pay_2')
  })

  it('тариф по умолчанию monthly, если plan не задан', async () => {
    const db = makeMockDb([{ id: 5, email: 'a@b.c', plan: null, payment_method_id: 'pm_5' }])
    await runRenewals(db, makeYk())
    expect(db.inserted[0][4]).toBe('monthly')
  })
})
