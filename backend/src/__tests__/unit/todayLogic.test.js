'use strict'

const { buildTasks, getOverdueCareTask } = require('../../utils/todayLogic')

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

// ─── Care-задачи (Рыхление/Прополка/…) ─────────────────────────────────────────

describe('care_task_due', () => {
  // Посадка 10 дней назад, без полива/пересадки/урожая — изолируем care-задачу
  const carePlanting = (careTasks) => makePlanting({
    planted_at: daysAgo(10, TODAY),
    watering_freq_days: null,
    transplant_days: null,
    harvest_days: 90,
    frost_sensitive: false,
    care_tasks: careTasks,
  })

  it('просроченная >1 дня care-задача НЕ теряется (регресс окна -1..+3)', () => {
    // day_offset=5, посадке 10 дней → просрочка 5 дней
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 5 }])], null, {}, {}, [], TODAY)
    const t = tasks.find(t => t.type === 'care_task_due' && t.care_task_name === 'Прополка')
    expect(t).toBeTruthy()
    expect(t.days_overdue).toBe(5)
  })

  it('НЕ показывается, если действие сделано в день наступления или позже', () => {
    // due date = posadка + 5 дн.; прополка залогирована 2 дня назад (позже due) → выполнено
    const lastCare = { 1: { weeding: new Date(daysAgo(2, TODAY)) } }
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 5 }])], null, {}, {}, [], TODAY, {}, null, lastCare)
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(false)
  })

  it('ПОКАЗЫВАЕТСЯ, если последнее действие было ДО наступления задачи', () => {
    // due = posadка + 5 дн. (≈5 дн. назад); прополка была 8 дней назад (до due) → ещё актуально
    const lastCare = { 1: { weeding: new Date(daysAgo(8, TODAY)) } }
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 5 }])], null, {}, {}, [], TODAY, {}, null, lastCare)
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(true)
  })

  it('НЕ показывается раньше чем за 3 дня до наступления', () => {
    // day_offset=20, посадке 10 дней → ещё 10 дней до задачи (> +3)
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 20 }])], null, {}, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(false)
  })

  it('показывается за 2 дня до наступления (в окне +3)', () => {
    // day_offset=12, посадке 10 дней → через 2 дня
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 12 }])], null, {}, {}, [], TODAY)
    const t = tasks.find(t => t.type === 'care_task_due')
    expect(t).toBeTruthy()
    expect(t.days_overdue).toBe(0)
  })

  it('НЕ показывается, если действие сделано сегодня (careActionsToday)', () => {
    const tasks = buildTasks(
      [carePlanting([{ name: 'Прополка', day_offset: 5 }])],
      null, {}, {}, [], TODAY, { 1: ['weeding'] }
    )
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(false)
  })

  it('одиночная care-задача остаётся адресной (planting_id сохранён)', () => {
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 5 }])], null, {}, {}, [], TODAY)
    const t = tasks.find(t => t.type === 'care_task_due')
    expect(t.planting_id).toBe(1)
    expect(t.crops).toBeUndefined()
  })

  it('однотипные care-задачи разных посадок группируются в одну карточку', () => {
    const weeders = ['Томат', 'Огурец', 'Перец'].map((c, i) => makePlanting({
      id: i + 1, crop_name: c, planted_at: daysAgo(10, TODAY),
      watering_freq_days: null, transplant_days: null, harvest_days: 90,
      frost_sensitive: false, care_tasks: [{ name: 'Прополка', day_offset: 5 }],
    }))
    const tasks = buildTasks(weeders, null, {}, {}, [], TODAY)
    const care = tasks.filter(t => t.type === 'care_task_due')
    expect(care).toHaveLength(1)
    expect(care[0].planting_id).toBeNull()
    expect(care[0].crops).toEqual(['Томат', 'Огурец', 'Перец'])
    expect(care[0].days_overdue).toBe(5)
  })

  it('разные имена care-задач НЕ группируются вместе', () => {
    const plantings = [
      makePlanting({ id: 1, crop_name: 'Томат', planted_at: daysAgo(10, TODAY), watering_freq_days: null, transplant_days: null, harvest_days: 90, frost_sensitive: false, care_tasks: [{ name: 'Прополка', day_offset: 5 }] }),
      makePlanting({ id: 2, crop_name: 'Огурец', planted_at: daysAgo(10, TODAY), watering_freq_days: null, transplant_days: null, harvest_days: 90, frost_sensitive: false, care_tasks: [{ name: 'Рыхление', day_offset: 5 }] }),
    ]
    const tasks = buildTasks(plantings, null, {}, {}, [], TODAY)
    expect(tasks.filter(t => t.type === 'care_task_due')).toHaveLength(2)
  })
})

// ─── getOverdueCareTask (индикатор «Требует ухода» на экране «Посадки») ────────

describe('getOverdueCareTask', () => {
  // posadка 10 дней назад → плановое наступление в day_offset дней
  const plantedAt = new Date(daysAgo(10, TODAY))

  it('возвращает просроченную задачу с days_overdue', () => {
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 5 }], plantedAt, TODAY, 90)
    expect(r).toEqual({ name: 'Прополка', days_overdue: 5 })
  })

  it('наступившая сегодня задача → days_overdue = 0', () => {
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 10 }], plantedAt, TODAY, 90)
    expect(r).toEqual({ name: 'Прополка', days_overdue: 0 })
  })

  it('будущая задача (ещё не наступила) → null', () => {
    // в отличие от /today здесь НЕ показываем за 3 дня вперёд
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 12 }], plantedAt, TODAY, 90)
    expect(r).toBeNull()
  })

  it('null если действие сделано в день наступления или позже (doneSinceDue)', () => {
    const lastCare = { weeding: new Date(daysAgo(2, TODAY)) } // позже due (due ≈ 5 дн. назад)
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 5 }], plantedAt, TODAY, 90, lastCare)
    expect(r).toBeNull()
  })

  it('показывается, если действие было ДО наступления задачи', () => {
    const lastCare = { weeding: new Date(daysAgo(8, TODAY)) } // до due
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 5 }], plantedAt, TODAY, 90, lastCare)
    expect(r).toEqual({ name: 'Прополка', days_overdue: 5 })
  })

  it('null если действие сделано сегодня (todayActions)', () => {
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 5 }], plantedAt, TODAY, 90, {}, ['weeding'])
    expect(r).toBeNull()
  })

  it('выбирает самую просроченную из нескольких задач', () => {
    const tasks = [
      { name: 'Прополка', day_offset: 8 }, // overdue 2
      { name: 'Рыхление', day_offset: 3 }, // overdue 7
    ]
    const r = getOverdueCareTask(tasks, plantedAt, TODAY, 90)
    expect(r).toEqual({ name: 'Рыхление', days_overdue: 7 })
  })

  it('null если care_tasks пустой', () => {
    expect(getOverdueCareTask([], plantedAt, TODAY, 90)).toBeNull()
    expect(getOverdueCareTask(null, plantedAt, TODAY, 90)).toBeNull()
  })

  it('учитывает repeat_days (берёт последнее наступление)', () => {
    // day_offset=3, repeat=3 → наступления 3,6,9; посадке 10 дней → последнее на 9 → overdue 1
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 3, repeat_days: 3 }], plantedAt, TODAY, 90)
    expect(r).toEqual({ name: 'Прополка', days_overdue: 1 })
  })
})
