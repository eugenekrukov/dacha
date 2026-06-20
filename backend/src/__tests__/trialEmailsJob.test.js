'use strict'

const { runTrialEmails } = require('../jobs/trialEmailsJob')
const { trialEmailContent } = require('../services/emailService')

// Мок-БД: отдаёт кандидатов, эмулирует проверку дублей и сбор статистики, копит INSERT в trial_emails.
function makeMockDb(candidates, { alreadySent = [], stats = { plantings: 3, actions: 7 } } = {}) {
  const inserted = []
  return {
    inserted,
    async query(sql, params) {
      if (sql.includes('FROM users u') && sql.includes('trial_started_at')) {
        return { rows: candidates }
      }
      if (sql.includes('FROM trial_emails WHERE user_id')) {
        const [userId, day] = params
        const dup = alreadySent.some(([u, d]) => u === userId && d === day)
        return { rows: dup ? [{ '?column?': 1 }] : [] }
      }
      if (sql.includes('AS plantings') && sql.includes('AS actions')) {
        return { rows: [stats] }
      }
      if (sql.includes('INSERT INTO trial_emails')) {
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
    async sendTrialEmail(to, name, day, stats) {
      calls.push({ to, name, day, stats })
      return result
    }
  }
}

describe('runTrialEmails (письма жизненного цикла триала)', () => {
  it('шлёт письмо только на дни из списка (1/3/5/6/8) и фиксирует отправку', async () => {
    const db = makeMockDb([
      { id: 1, email: 'a@b.c', name: 'Аня', day: 1 },
      { id: 2, email: 'd@e.f', name: null, day: 2 },  // день 2 — не в списке, пропустить
      { id: 3, email: 'g@h.i', name: 'Гена', day: 8 }
    ])
    const mailer = makeMailer()

    await runTrialEmails(db, mailer)

    const days = mailer.calls.map((c) => c.day).sort()
    expect(days).toEqual([1, 8])
    // Зафиксированы обе успешные отправки
    expect(db.inserted.map((p) => p[0]).sort()).toEqual([1, 3])
  })

  it('для дней 5 и 6 подтягивает статистику (посадки/действия)', async () => {
    const db = makeMockDb([{ id: 5, email: 'x@y.z', name: 'Ира', day: 5 }],
      { stats: { plantings: 4, actions: 12 } })
    const mailer = makeMailer()

    await runTrialEmails(db, mailer)

    expect(mailer.calls).toHaveLength(1)
    expect(mailer.calls[0].stats).toEqual({ plantings: 4, actions: 12 })
  })

  it('не шлёт повторно, если письмо на этот день уже отправлялось', async () => {
    const db = makeMockDb([{ id: 7, email: 'p@q.r', name: 'Поля', day: 3 }],
      { alreadySent: [[7, 3]] })
    const mailer = makeMailer()

    await runTrialEmails(db, mailer)

    expect(mailer.calls).toHaveLength(0)
    expect(db.inserted).toHaveLength(0)
  })

  it('не фиксирует отправку, если почта недоступна (mailer вернул false)', async () => {
    const db = makeMockDb([{ id: 9, email: 's@t.u', name: 'Сёма', day: 6 }])
    const mailer = makeMailer({ result: false })

    await runTrialEmails(db, mailer)

    expect(mailer.calls).toHaveLength(1)
    expect(db.inserted).toHaveLength(0)  // не записали — повторим в следующий запуск
  })
})

describe('trialEmailContent (ветвление контента)', () => {
  it('день 1 без участка зовёт создать участок; с участком — другое письмо', () => {
    const noGarden = trialEmailContent(1, null, {}, { hasGarden: false })
    const withGarden = trialEmailContent(1, null, {}, { hasGarden: true })
    expect(noGarden.text).toContain('Создайте участок')
    expect(withGarden.subject).not.toEqual(noGarden.subject)
    expect(withGarden.text).toContain('уже завели участок')
  })

  it('день 5 без активности не показывает «0», а зовёт начать', () => {
    const empty = trialEmailContent(5, null, { plantings: 0, actions: 0 }, { hasGarden: true })
    const active = trialEmailContent(5, null, { plantings: 3, actions: 7 }, { hasGarden: true })
    expect(empty.subject).toContain('Начните')
    expect(empty.text).not.toContain('0')
    expect(active.subject).toContain('цифрах')
    expect(active.text).toContain('3')
  })

  it('без имени предложение начинается с заглавной буквы', () => {
    const c = trialEmailContent(1, null, {}, { hasGarden: false })
    expect(c.text.charAt(0)).toEqual(c.text.charAt(0).toUpperCase())
    expect(c.text.startsWith('Рады')).toBe(true)
  })
})
