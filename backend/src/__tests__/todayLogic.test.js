'use strict'

const { formatTasks } = require('../utils/todayLogic')

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

  it('просроченная задача → «Просрочено на N дн.»', () => {
    const [t] = formatTasks([{ ...base, days_overdue: 3, days_until: 0 }])
    expect(t.description).toBe('Просрочено на 3 дн.')
  })
})
