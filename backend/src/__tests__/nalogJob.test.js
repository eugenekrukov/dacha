'use strict'

const { runNalogReceipts } = require('../jobs/nalogJob')

const MAX_ATTEMPTS = 5

// Мок БД: отдаёт батч claim'ом, фиксирует UPDATE'ы.
function makeDb({ pending = [], cancel = [] } = {}) {
  const updates = []
  return {
    updates,
    async query(sql, params) {
      if (sql.includes("npd_status = 'pending'") && sql.includes('RETURNING')) {
        const rows = pending.splice(0, 2) // claim ≤ 2
        return { rows }
      }
      if (sql.includes("npd_status = 'cancel_pending'") && sql.includes('RETURNING')) {
        const rows = cancel.splice(0, 2)
        return { rows }
      }
      updates.push({ sql, params })
      return { rows: [] }
    }
  }
}

function makeNalog({ enabled = true, add, cancel } = {}) {
  return {
    isEnabled: () => enabled,
    addIncome: add || (async () => 'rcpt_default'),
    cancelIncome: cancel || (async () => ({})),
    getReceiptUrl: (uuid) => `https://lknpd.nalog.ru/api/v1/receipt/INN/${uuid}/print`
  }
}

function makeEmail() {
  const sent = []
  return {
    sent,
    sendReceiptLink: async (...a) => { sent.push(a); return true },
    sendMail: async () => true
  }
}

describe('runNalogReceipts', () => {
  it('nalog отключён → no-op', async () => {
    const db = makeDb({ pending: [{ id: 1 }] })
    await runNalogReceipts(db, makeNalog({ enabled: false }), makeEmail())
    expect(db.updates.length).toBe(0)
  })

  it('pending → регистрирует чек, помечает registered, шлёт письмо', async () => {
    const db = makeDb({ pending: [{ id: 10, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date('2026-06-18T09:00:00Z') }] })
    const email = makeEmail()
    await runNalogReceipts(db, makeNalog({ add: async () => 'rcpt_10' }), email)
    const reg = db.updates.find(u => u.sql.includes("npd_status = 'registered'"))
    expect(reg).toBeTruthy()
    expect(reg.params).toContain('rcpt_10')
    expect(email.sent.length).toBe(1)
    expect(email.sent[0][0]).toBe('a@b.c')
  })

  it('cancel_pending → аннулирует чек, помечает canceled', async () => {
    const db = makeDb({ cancel: [{ id: 20, npd_receipt_uuid: 'rcpt_20' }] })
    let cancelled = null
    const nalog = makeNalog({ cancel: async (_db, uuid, reason) => { cancelled = { uuid, reason } } })
    await runNalogReceipts(db, nalog, makeEmail())
    expect(cancelled).toEqual({ uuid: 'rcpt_20', reason: 'REFUND' })
    expect(db.updates.some(u => u.sql.includes("npd_status = 'canceled'"))).toBe(true)
  })

  it('ошибка регистрации → инкремент attempts и npd_last_error (остаётся pending)', async () => {
    const db = makeDb({ pending: [{ id: 30, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date(), npd_attempts: 0 }] })
    const nalog = makeNalog({ add: async () => { throw new Error('ФНС недоступна') } })
    await runNalogReceipts(db, nalog, makeEmail())
    const errUpd = db.updates.find(u => u.sql.includes('npd_last_error') && !u.sql.includes("'failed'"))
    expect(errUpd).toBeTruthy()
    expect(errUpd.params.join(' ')).toContain('ФНС недоступна')
  })

  it('после MAX_ATTEMPTS ошибок → npd_status failed', async () => {
    const db = makeDb({ pending: [{ id: 40, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date(), npd_attempts: MAX_ATTEMPTS - 1 }] })
    const nalog = makeNalog({ add: async () => { throw new Error('опять ошибка') } })
    await runNalogReceipts(db, nalog, makeEmail())
    expect(db.updates.some(u => u.sql.includes("npd_status = 'failed'"))).toBe(true)
  })
})
