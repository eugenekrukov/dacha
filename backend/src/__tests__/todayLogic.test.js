'use strict'

const { formatTasks, urgencyLevel, URGENCY_SOON_MAX_DAYS } = require('../utils/todayLogic')

// Регресс: care-задача, показанная с опережением, не должна писать «Сделайте сегодня»,
// если до неё ещё N дней — иначе «Сегодня» расходится с «через N дн.» на карточке посадки.
describe('formatTasks — care_task_due label', () => {
  const base = { type: 'care_task_due', priority: 3, care_task_name: 'Прореживание', crop_name: 'Редис', planting_id: 1 }

  it('будущая задача → «Через N дн.»', () => {
    const [t] = formatTasks([{ ...base, days_overdue: 0, days_until: 2 }])
    expect(t.description).toBe('Через 2 дн.')
  })

  it('задача сегодня → «Сделайте сегодня»', () => {
    const [t] = formatTasks([{ ...base, days_overdue: 0, days_until: 0 }])
    expect(t.description).toBe('Сделайте сегодня')
  })

  it('просроченная задача → «Пора — задержка N дн.»', () => {
    const [t] = formatTasks([{ ...base, days_overdue: 3, days_until: 0 }])
    expect(t.description).toBe('Пора — задержка 3 дн.')
  })
})

// Градация срочности: одна пилюля на все просрочки не различала «горит сегодня»
// и «висит две недели» — на «Сегодня» одновременно горело 6+ одинаковых меток.
describe('urgencyLevel — ступени срочности', () => {
  const care = { type: 'care_task_due' }

  it('порог «скоро» — 3 дня', () => {
    expect(URGENCY_SOON_MAX_DAYS).toBe(3)
  })

  it('без просрочки (сегодня или предстоит) → normal', () => {
    expect(urgencyLevel({ ...care, days_overdue: 0 })).toBe('normal')
    expect(urgencyLevel({ ...care })).toBe('normal')
    expect(urgencyLevel({ ...care, days_overdue: 0, days_until: 3 })).toBe('normal')
  })

  it('просрочка 1–3 дня → soon', () => {
    expect(urgencyLevel({ ...care, days_overdue: 1 })).toBe('soon')
    expect(urgencyLevel({ ...care, days_overdue: 3 })).toBe('soon')
  })

  it('просрочка больше 3 дней → late', () => {
    expect(urgencyLevel({ ...care, days_overdue: 4 })).toBe('late')
    expect(urgencyLevel({ ...care, days_overdue: 14 })).toBe('late')
  })

  it('заморозки → critical независимо от просрочки (окно погоды, ждать нельзя)', () => {
    expect(urgencyLevel({ type: 'frost_alert', days_overdue: 0 })).toBe('critical')
    expect(urgencyLevel({ type: 'frost_alert', days_until: 1 })).toBe('critical')
  })

  it('formatTasks отдаёт urgency каждой задаче', () => {
    const tasks = formatTasks([
      { ...care, priority: 3, days_overdue: 0 },
      { ...care, priority: 3, days_overdue: 2 },
      { ...care, priority: 3, days_overdue: 9 },
      { type: 'frost_alert', priority: 1, crop_name: 'Томат', days_until: 1 },
    ])
    expect(tasks.map(t => t.urgency)).toEqual(['normal', 'soon', 'late', 'critical'])
  })
})
