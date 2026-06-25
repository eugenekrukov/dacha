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

  it('ошибка отмены до лимита → инкремент attempts (остаётся cancel_pending)', async () => {
    const db = makeDb({ cancel: [{ id: 51, npd_receipt_uuid: 'rcpt_51', npd_attempts: 0 }] })
    const nalog = makeNalog({ cancel: async () => { throw new Error('временная ошибка') } })
    await runNalogReceipts(db, nalog, makeEmail())
    const errUpd = db.updates.find(u => u.sql.includes('npd_last_error') && !u.sql.includes("'failed'"))
    expect(errUpd).toBeTruthy()
    expect(errUpd.params.join(' ')).toContain('временная ошибка')
  })

  it('ошибка отмены после MAX_ATTEMPTS → npd_status failed', async () => {
    const db = makeDb({ cancel: [{ id: 50, npd_receipt_uuid: 'rcpt_50', npd_attempts: MAX_ATTEMPTS - 1 }] })
    const nalog = makeNalog({ cancel: async () => { throw new Error('отмена не прошла') } })
    await runNalogReceipts(db, nalog, makeEmail())
    expect(db.updates.some(u => u.sql.includes("npd_status = 'failed'"))).toBe(true)
  })

  it('pending без email → регистрирует, письмо не шлёт', async () => {
    const db = makeDb({ pending: [{ id: 60, user_id: 1, email: null, amount: '299.00', plan: 'monthly', created_at: new Date(), npd_attempts: 0 }] })
    const email = makeEmail()
    await runNalogReceipts(db, makeNalog({ add: async () => 'rcpt_60' }), email)
    expect(db.updates.some(u => u.sql.includes("npd_status = 'registered'"))).toBe(true)
    expect(email.sent.length).toBe(0)
  })
})

// Мок БД с реальной фильтрацией по npd_status (а не статичной выдачей фикстур из массива) —
// нужен, чтобы проверить, что claim (pending → registering) реально не даёт второму
// параллельному прогону job забрать ту же строку.
function makeStatefulDb(rows) {
  const state = new Map(rows.map(r => [r.id, { npd_attempts: 0, ...r }]))
  return {
    state,
    async query(sql, params) {
      if (sql.includes("SET npd_status = 'registering'") && sql.includes('RETURNING')) {
        const limit = params[0]
        const claimed = [...state.values()].filter(r => r.npd_status === 'pending').slice(0, limit)
        claimed.forEach(r => { r.npd_status = 'registering' })
        return { rows: claimed.map(r => ({ ...r })) }
      }
      if (sql.includes("SET npd_status = 'canceling'") && sql.includes('RETURNING')) {
        return { rows: [] }
      }
      if (sql.startsWith('UPDATE payments SET npd_status =')) {
        const newStatus = sql.match(/npd_status = '(\w+)'/)[1]
        const hasGuard = sql.includes('AND npd_status')
        const idParam = params[params.length - 1]
        const row = state.get(idParam)
        if (row && (!hasGuard || row.npd_status === 'registering')) row.npd_status = newStatus
        return { rows: [], rowCount: row ? 1 : 0 }
      }
      return { rows: [] }
    }
  }
}

describe('runNalogReceipts — защита от параллельного запуска', () => {
  it('claim не даёт двум параллельным прогонам зарегистрировать один платёж дважды', async () => {
    const db = makeStatefulDb([
      { id: 100, user_id: 1, email: 'a@b.c', amount: '299.00', plan: 'monthly', created_at: new Date(), npd_status: 'pending' }
    ])
    let addIncomeCalls = 0
    const nalog = makeNalog({ add: async () => { addIncomeCalls++; await new Promise((r) => setTimeout(r, 5)); return 'rcpt_100' } })
    await Promise.all([
      runNalogReceipts(db, nalog, makeEmail()),
      runNalogReceipts(db, nalog, makeEmail())
    ])
    expect(addIncomeCalls).toBe(1)
    expect(db.state.get(100).npd_status).toBe('registered')
  })
})
