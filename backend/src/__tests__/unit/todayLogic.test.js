'use strict'

const { buildTasks } = require('../../utils/todayLogic')

// ─── Фабрики тестовых данных ─────────────────────────────────────────────────

function makePlanting(overrides = {}) {
  return {
    id: 1,
    crop_name: 'Помидор',
    stage: 'growing',
    planted_at: daysAgo(10),
    watering_freq_days: 3,
    transplant_days: 7,
    harvest_days: 90,
    frost_sensitive: true,
    ...overrides,
  }
}

function makeWeather(overrides = {}) {
  return {
    frost_risk: false,
    heat_risk: false,
    min_temp_c: 10,
    max_temp_c: 25,
    ...overrides,
  }
}

/** Возвращает ISO-строку: сегодня минус n дней */
function daysAgo(n, from = new Date('2026-06-01')) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const TODAY = new Date('2026-06-01')

// ─── Заморозки ────────────────────────────────────────────────────────────────

describe('frost_alert', () => {
  it('генерируется если frost_risk=true и культура frost_sensitive', () => {
    const tasks = buildTasks(
      [makePlanting({ frost_sensitive: true })],
      makeWeather({ frost_risk: true }),
      {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'frost_alert')).toBe(true)
  })

  it('НЕ генерируется если frost_risk=false', () => {
    const tasks = buildTasks(
      [makePlanting({ frost_sensitive: true })],
      makeWeather({ frost_risk: false }),
      {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'frost_alert')).toBe(false)
  })

  it('НЕ генерируется если культура не frost_sensitive', () => {
    const tasks = buildTasks(
      [makePlanting({ frost_sensitive: false })],
      makeWeather({ frost_risk: true }),
      {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'frost_alert')).toBe(false)
  })

  it('НЕ генерируется если weather=null', () => {
    const tasks = buildTasks(
      [makePlanting({ frost_sensitive: true })],
      null, {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'frost_alert')).toBe(false)
  })

  it('генерируется для каждой frost_sensitive посадки', () => {
    const plantings = [
      makePlanting({ id: 1, frost_sensitive: true }),
      makePlanting({ id: 2, frost_sensitive: true }),
      makePlanting({ id: 3, frost_sensitive: false }),
    ]
    const tasks = buildTasks(plantings, makeWeather({ frost_risk: true }), {}, {}, [], TODAY)
    const alerts = tasks.filter(t => t.type === 'frost_alert')
    expect(alerts).toHaveLength(2)
  })
})

// ─── Полив ────────────────────────────────────────────────────────────────────

describe('watering_due', () => {
  it('появляется когда дней без полива >= watering_freq_days', () => {
    // planted 10 дней назад, поливали 5 дней назад, частота = 3 дня → просрочка
    const lastWatered = { 1: new Date(daysAgo(5, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ watering_freq_days: 3 })],
      makeWeather(), lastWatered, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('НЕ появляется если поливали сегодня', () => {
    const lastWatered = { 1: new Date(TODAY) }
    const tasks = buildTasks(
      [makePlanting({ watering_freq_days: 3 })],
      makeWeather(), lastWatered, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })

  it('граничный случай: ровно N дней → появляется', () => {
    const lastWatered = { 1: new Date(daysAgo(3, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ watering_freq_days: 3 })],
      makeWeather(), lastWatered, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('days_overdue = 0 когда ровно на границе', () => {
    const lastWatered = { 1: new Date(daysAgo(3, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ watering_freq_days: 3 })],
      makeWeather(), lastWatered, {}, [], TODAY
    )
    const t = tasks.find(t => t.type === 'watering_due')
    expect(t.days_overdue).toBe(0)
  })
})

// ─── Пересадка ────────────────────────────────────────────────────────────────

describe('transplant_due', () => {
  it('появляется когда stage=sprouted и прошло >= transplant_days', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sprouted', transplant_days: 7, planted_at: daysAgo(10, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(true)
  })

  it('НЕ появляется если stage != sprouted', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', transplant_days: 7, planted_at: daysAgo(10, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(false)
  })

  it('НЕ появляется если не прошло достаточно дней', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sprouted', transplant_days: 14, planted_at: daysAgo(5, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(false)
  })
})

// ─── Урожай ───────────────────────────────────────────────────────────────────

describe('harvest_due', () => {
  it('появляется для stage=harvesting когда прошло >= harvest_days', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'harvesting', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
  })

  it('появляется для stage=growing', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
  })

  it('НЕ появляется для stage=sowing', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(false)
  })
})

// ─── Сортировка и лимит ───────────────────────────────────────────────────────

describe('сортировка и лимит', () => {
  it('frost_alert всегда идёт первым', () => {
    // Посадка с поливом (приоритет 3) и заморозком (приоритет 1)
    const p = makePlanting({ frost_sensitive: true, watering_freq_days: 1 })
    const lastWatered = { 1: new Date(daysAgo(5, TODAY)) }
    const tasks = buildTasks([p], makeWeather({ frost_risk: true }), lastWatered, {}, [], TODAY)
    expect(tasks[0].type).toBe('frost_alert')
  })

  it('возвращает не более 7 задач', () => {
    const plantings = Array.from({ length: 10 }, (_, i) =>
      makePlanting({ id: i + 1, frost_sensitive: true, watering_freq_days: 1 })
    )
    const lastWatered = plantings.reduce((acc, p) => {
      acc[p.id] = new Date(daysAgo(5, TODAY))
      return acc
    }, {})
    const tasks = buildTasks(plantings, makeWeather({ frost_risk: true }), lastWatered, {}, [], TODAY)
    expect(tasks.length).toBeLessThanOrEqual(7)
  })

  it('задачи с большей просрочкой идут раньше при одинаковом приоритете', () => {
    const plantings = [
      makePlanting({ id: 1, watering_freq_days: 3 }),
      makePlanting({ id: 2, watering_freq_days: 3 }),
    ]
    // id=1: полив 7 дней назад (overdue=4), id=2: полив 4 дня назад (overdue=1)
    const lastWatered = {
      1: new Date(daysAgo(7, TODAY)),
      2: new Date(daysAgo(4, TODAY)),
    }
    const tasks = buildTasks(plantings, makeWeather(), lastWatered, {}, [], TODAY)
    const wateringTasks = tasks.filter(t => t.type === 'watering_due')
    expect(wateringTasks[0].planting_id).toBe(1)
  })

  it('daysSincePlanting = 0 когда planted_at = сегодня', () => {
    const tasks = buildTasks(
      [makePlanting({ planted_at: TODAY.toISOString(), watering_freq_days: 1 })],
      makeWeather(), {}, {}, [], TODAY
    )
    // planted_at = сегодня, lastWatered = plantedAt → 0 дней без полива → нет задачи
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })
})

// ─── Пустые данные ────────────────────────────────────────────────────────────

describe('крайние случаи', () => {
  it('возвращает [] если нет посадок', () => {
    expect(buildTasks([], makeWeather(), {}, {}, [], TODAY)).toEqual([])
  })

  it('включает напоминания', () => {
    const reminders = [{ type: 'reminder', priority: 5, message: 'Test' }]
    const tasks = buildTasks([], makeWeather(), {}, {}, reminders, TODAY)
    expect(tasks.some(t => t.type === 'reminder')).toBe(true)
  })
})
