'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')
const { isSubscribed } = require('../utils/access')

/**
 * Stateful-мок БД для /billing. Хранит users и payments в памяти и реагирует на SQL роута.
 * ЮKassa в тестах отключена (нет env) → webhook доверяет телу запроса (getPayment не вызывается).
 */
function makeMockDb({ users = {}, payments = {} } = {}) {
  return {
    state: { users, payments },
    async query(sql, params) {
      const s = this.state

      if (sql.includes('SELECT status FROM payments WHERE yk_payment_id')) {
        const p = s.payments[params[0]]
        return { rows: p ? [{ status: p.status }] : [] }
      }
      if (sql.includes('SELECT id, email FROM users WHERE id')) {
        const u = s.users[params[0]]
        return { rows: u ? [{ id: params[0], email: u.email }] : [] }
      }
      if (sql.includes('SELECT subscription_until FROM users WHERE id')) {
        const u = s.users[params[0]] || {}
        return { rows: [{ subscription_until: u.subscription_until || null }] }
      }
      if (sql.includes('UPDATE users') && sql.includes('SET subscription_until')) {
        const [until, plan, autoRenew, savedCard, userId] = params
        const u = s.users[userId] || {}
        s.users[userId] = {
          ...u,
          subscription_until: until,
          plan,
          auto_renew: autoRenew,
          payment_method_id: savedCard != null ? savedCard : u.payment_method_id
        }
        return { rows: [] }
      }
      if (sql.includes('UPDATE users SET auto_renew = false')) {
        const u = s.users[params[0]] || {}
        u.auto_renew = false
        s.users[params[0]] = u
        return { rows: [{ auto_renew: false, subscription_until: u.subscription_until || null }] }
      }
      if (sql.includes('INSERT INTO payments')) {
        const userId = params[0]
        const ykId = params[1]
        let status = 'pending'
        if (sql.includes("'succeeded'")) status = 'succeeded'
        else if (sql.includes("'canceled'")) status = 'canceled'
        s.payments[ykId] = { user_id: userId, status, params }
        return { rows: [] }
      }
      throw new Error('Неожиданный SQL в моке: ' + sql)
    }
  }
}

function succeededWebhook(overrides = {}) {
  return {
    event: 'payment.succeeded',
    object: {
      id: overrides.id || 'pay_001',
      status: 'succeeded',
      amount: { value: '299.00', currency: 'RUB' },
      metadata: { user_id: String(overrides.userId || 1), plan: overrides.plan || 'monthly' },
      payment_method: { id: 'pm_card_1', saved: true, type: 'bank_card' }
    }
  }
}

describe('POST /billing/create-payment', () => {
  it('биллинг отключён (нет ключей ЮKassa) → 503 billing_disabled', async () => {
    const app = await buildApp(makeMockDb({ users: { 1: { email: 'a@b.c' } } }))
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/billing/create-payment').set('Authorization', `Bearer ${token}`).send({ plan: 'monthly' })
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('billing_disabled')
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/billing/create-payment').send({ plan: 'monthly' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('неизвестный тариф → 400 (валидация схемы)', async () => {
    const app = await buildApp(makeMockDb({ users: { 1: { email: 'a@b.c' } } }))
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/billing/create-payment').set('Authorization', `Bearer ${token}`).send({ plan: 'weekly' })
    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('POST /billing/webhook', () => {
  it('payment.succeeded → продлевает подписку, включает автопродление, сохраняет карту', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db)
    const res = await supertest(app.server).post('/billing/webhook').send(succeededWebhook())

    expect(res.status).toBe(200)
    const u = db.state.users[1]
    expect(isSubscribed(u.subscription_until)).toBe(true)
    const days = (new Date(u.subscription_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)
    expect(u.auto_renew).toBe(true)
    expect(u.plan).toBe('monthly')
    expect(u.payment_method_id).toBe('pm_card_1')
    expect(db.state.payments['pay_001'].status).toBe('succeeded')
    await app.close()
  })

  it('годовой тариф → доступ ~365 дней', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db)
    await supertest(app.server).post('/billing/webhook')
      .send(succeededWebhook({ id: 'pay_year', plan: 'yearly' }))
    const days = (new Date(db.state.users[1].subscription_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(364)
    expect(days).toBeLessThan(366)
    await app.close()
  })

  it('идемпотентность: повторный succeeded-вебхук не продлевает подписку дважды', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db)
    await supertest(app.server).post('/billing/webhook').send(succeededWebhook())
    const firstUntil = db.state.users[1].subscription_until
    const res = await supertest(app.server).post('/billing/webhook').send(succeededWebhook())
    expect(res.status).toBe(200)
    expect(db.state.users[1].subscription_until).toBe(firstUntil)  // не изменилось
    await app.close()
  })

  it('продление от конца активной подписки (не теряем оплаченное)', async () => {
    const future = new Date(Date.now() + 20 * 86_400_000)
    const db = makeMockDb({ users: { 1: { email: 'a@b.c', subscription_until: future } } })
    const app = await buildApp(db)
    await supertest(app.server).post('/billing/webhook').send(succeededWebhook())
    const days = (new Date(db.state.users[1].subscription_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(49)   // 20 остаток + 30 новых
    expect(days).toBeLessThan(51)
    await app.close()
  })

  it('payment.canceled → запись canceled, подписка не меняется', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db)
    const res = await supertest(app.server).post('/billing/webhook').send({
      event: 'payment.canceled',
      object: { id: 'pay_cancel', status: 'canceled', metadata: { user_id: '1', plan: 'monthly' } }
    })
    expect(res.status).toBe(200)
    expect(db.state.payments['pay_cancel'].status).toBe('canceled')
    expect(db.state.users[1].subscription_until).toBeUndefined()
    await app.close()
  })

  it('вебхук без metadata.user_id → 200 no-op', async () => {
    const db = makeMockDb()
    const app = await buildApp(db)
    const res = await supertest(app.server).post('/billing/webhook').send({
      event: 'payment.succeeded', object: { id: 'x', status: 'succeeded', metadata: {} }
    })
    expect(res.status).toBe(200)
    await app.close()
  })

  it('карта не сохранена (saved=false) → подписка продлена, payment_method_id не выставлен', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c' } } })
    const app = await buildApp(db)
    const wh = succeededWebhook()
    wh.object.payment_method.saved = false
    await supertest(app.server).post('/billing/webhook').send(wh)
    expect(isSubscribed(db.state.users[1].subscription_until)).toBe(true)
    expect(db.state.users[1].payment_method_id).toBeUndefined()
    expect(db.state.users[1].auto_renew).toBe(false)   // нет карты → продление вручную
    await app.close()
  })
})

describe('POST /billing/cancel-autorenew', () => {
  it('выключает автопродление', async () => {
    const db = makeMockDb({ users: { 1: { email: 'a@b.c', auto_renew: true, subscription_until: new Date(Date.now() + 10 * 86_400_000) } } })
    const app = await buildApp(db)
    const token = makeToken(app, 1)
    const res = await supertest(app.server)
      .post('/billing/cancel-autorenew').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(200)
    expect(res.body.auto_renew).toBe(false)
    expect(db.state.users[1].auto_renew).toBe(false)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/billing/cancel-autorenew').send({})
    expect(res.status).toBe(401)
    await app.close()
  })
})
