'use strict'

const { runSubscriptionEmails, SUBSCRIPTION_EMAIL_OFFSETS } = require('../jobs/subscriptionEmailsJob')
const { subscriptionEmailContent } = require('../services/emailService')

// Мок-БД: отдаёт кандидатов, эмулирует проверку дублей, копит INSERT в subscription_emails.
function makeMockDb(candidates, { alreadySent = [] } = {}) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      if (sql.includes('FROM users u') && sql.includes('subscription_until')) {
        return { rows: candidates }
      }
      if (sql.includes('FROM subscription_emails WHERE user_id')) {
        const [userId, until, offset] = params
        const dup = alreadySent.some(([u, t, o]) => u === userId && t === until && o === offset)
        return { rows: dup ? [{ '?column?': 1 }] : [] }
      }
      if (sql.includes('INSERT INTO subscription_emails')) {
        inserted.push(params)
        return { rows: [] }
      }
      throw new Error('Неожиданный SQL в моке: ' + sql)
    }
  }
}

function makeMailer({ result = true } = {}) {
  const calls = []
  return {
    calls,
    async sendSubscriptionEmail(to, offset) {
      calls.push({ to, offset })
      return result
    }
  }
}

const UNTIL = '2026-06-20T00:00:00.000Z'

describe('runSubscriptionEmails (письма об окончании платной подписки)', () => {
  it('шлёт письмо только на смещения из списка (-3/0/3/30) и фиксирует отправку', async () => {
    const db = makeMockDb([
      { id: 1, email: 'a@b.c', subscription_until: UNTIL, offset_days: -3 },
      { id: 2, email: 'd@e.f', subscription_until: UNTIL, offset_days: 1 },  // не в списке — пропустить
      { id: 3, email: 'g@h.i', subscription_until: UNTIL, offset_days: 30 }
    ])
    const mailer = makeMailer()

    await runSubscriptionEmails(db, mailer)

    const offsets = mailer.calls.map((c) => c.offset).sort((a, b) => a - b)
    expect(offsets).toEqual([-3, 30])
    expect(db.inserted.map((p) => p[0]).sort()).toEqual([1, 3])
  })

  it('не шлёт повторно для того же цикла подписки (user_id + subscription_until + offset)', async () => {
    const db = makeMockDb(
      [{ id: 7, email: 'p@q.r', subscription_until: UNTIL, offset_days: 0 }],
      { alreadySent: [[7, UNTIL, 0]] }
    )
    const mailer = makeMailer()

    await runSubscriptionEmails(db, mailer)

    expect(mailer.calls).toHaveLength(0)
    expect(db.inserted).toHaveLength(0)
  })

  it('после продления (новый subscription_until) письмо на то же смещение шлётся снова', async () => {
    const newUntil = '2026-07-20T00:00:00.000Z'
    const db = makeMockDb(
      [{ id: 7, email: 'p@q.r', subscription_until: newUntil, offset_days: 0 }],
      { alreadySent: [[7, UNTIL, 0]] }  // старый цикл уже отмечен — новый цикл не должен блокироваться
    )
    const mailer = makeMailer()

    await runSubscriptionEmails(db, mailer)

    expect(mailer.calls).toHaveLength(1)
    expect(db.inserted).toHaveLength(1)
  })

  it('не фиксирует отправку, если почта недоступна (mailer вернул false)', async () => {
    const db = makeMockDb([{ id: 9, email: 's@t.u', subscription_until: UNTIL, offset_days: 3 }])
    const mailer = makeMailer({ result: false })

    await runSubscriptionEmails(db, mailer)

    expect(mailer.calls).toHaveLength(1)
    expect(db.inserted).toHaveLength(0)
  })
})

describe('subscriptionEmailContent (контент по смещению)', () => {
  it('покрывает все смещения из SUBSCRIPTION_EMAIL_OFFSETS и не возвращает null', () => {
    for (const offset of SUBSCRIPTION_EMAIL_OFFSETS) {
      expect(subscriptionEmailContent(offset)).not.toBeNull()
    }
  })

  it('неизвестное смещение — null', () => {
    expect(subscriptionEmailContent(99)).toBeNull()
  })

  it('тексты обезличены — без подстановки имени, с заглавной буквы', () => {
    for (const offset of SUBSCRIPTION_EMAIL_OFFSETS) {
      const c = subscriptionEmailContent(offset)
      expect(c.text.charAt(0)).toEqual(c.text.charAt(0).toUpperCase())
    }
  })

  it('письма до и в день окончания зовут продлить, мотивашки после — тоже', () => {
    expect(subscriptionEmailContent(-3).text).toContain('Продлите подписку')
    expect(subscriptionEmailContent(0).text).toContain('Продлите подписку')
    expect(subscriptionEmailContent(3).text).toContain('Продлите подписку')
    expect(subscriptionEmailContent(30).text).toContain('Продлите подписку')
  })
})
