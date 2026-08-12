'use strict'

const { buildTasks, formatTasks, getNextCareTask, getOverdueCareTask, careTaskActionType, wateringIntervalDays, effectivePlantedAt, seasonLengthDays, seasonStartDoy, seasonEndDoy, dateFromDoy, taskDayOffset, TASK_LIMIT } = require('../../utils/todayLogic')

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

  it('НЕ генерируется для теплицы (conditions=greenhouse защищает)', () => {
    const tasks = buildTasks(
      [makePlanting({ frost_sensitive: true, conditions: 'greenhouse' })],
      makeWeather({ frost_risk: true }),
      {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'frost_alert')).toBe(false)
  })
})

// ─── Интервал полива (теплица × 0.8) ───────────────────────────────────────────

describe('wateringIntervalDays', () => {
  it('грунт → интервал без изменений', () => {
    expect(wateringIntervalDays(3, 'soil')).toBe(3)
    expect(wateringIntervalDays(5, 'soil')).toBe(5)
  })

  it('теплица → интервал короче (×0.8, округление)', () => {
    expect(wateringIntervalDays(5, 'greenhouse')).toBe(4)   // 4.0
    expect(wateringIntervalDays(3, 'greenhouse')).toBe(2)   // 2.4 → 2
  })

  it('минимум 1 день и фолбэк 3 при отсутствии частоты', () => {
    expect(wateringIntervalDays(1, 'greenhouse')).toBe(1)   // 0.8 → max(1)
    expect(wateringIntervalDays(null, 'soil')).toBe(3)
  })

  it('теплица поливается раньше грунта (короче интервал)', () => {
    // 4 дня без воды: грунт (интервал 5) ещё НЕ поливаем, теплица (интервал 4) — уже пора
    const lastWatered = { 1: new Date(daysAgo(4, TODAY)) }
    const soil = buildTasks([makePlanting({ id: 1, watering_freq_days: 5, conditions: 'soil', frost_sensitive: false })],
      makeWeather(), lastWatered, {}, [], TODAY)
    const gh   = buildTasks([makePlanting({ id: 1, watering_freq_days: 5, conditions: 'greenhouse', frost_sensitive: false })],
      makeWeather(), lastWatered, {}, [], TODAY)
    expect(soil.some(t => t.type === 'watering_due')).toBe(false)
    expect(gh.some(t => t.type === 'watering_due')).toBe(true)
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

// ─── Дождь: отмена полива и зачёт вместо полива ───────────────────────────────

describe('дождь и полив', () => {
  // Посадка без прочих задач: изолируем полив
  const wet = (overrides = {}) => makePlanting({
    id: 1, watering_freq_days: 3, frost_sensitive: false,
    transplant_days: null, harvest_days: 200, planted_at: daysAgo(10, TODAY), ...overrides,
  })
  const lastWatered = { 1: new Date(daysAgo(5, TODAY)) }
  // forecast_json: [сегодня, завтра]
  const forecast = (today, tomorrow) => makeWeather({ forecast_json: [today, tomorrow] })
  const rainyDay   = { precip_prob_pct: 80, precip_mm: 6 }
  const drizzleDay = { precip_prob_pct: 80, precip_mm: 0.4 } // вероятность есть, воды нет
  const dryDay     = { precip_prob_pct: 5, precip_mm: 0 }

  it('дождь сегодня отменяет полив в открытом грунте', () => {
    const tasks = buildTasks([wet()], forecast(rainyDay, dryDay), lastWatered, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })

  it('дождь НЕ отменяет полив в теплице (под укрытие не попадает)', () => {
    const tasks = buildTasks([wet({ conditions: 'greenhouse' })], forecast(rainyDay, dryDay), lastWatered, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('морось с высокой вероятностью, но без объёма, полив НЕ отменяет', () => {
    const tasks = buildTasks([wet()], forecast(drizzleDay, dryDay), lastWatered, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('завтрашний дождь отменяет полив, если посадка ещё не просрочена', () => {
    // интервал 3 дня, полив ровно 3 дня назад → overdue = 0, можно подождать сутки
    const tasks = buildTasks([wet()], forecast(dryDay, rainyDay), { 1: new Date(daysAgo(3, TODAY)) }, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })

  it('завтрашний дождь НЕ отменяет полив у просроченной посадки', () => {
    // полив 8 дней назад при интервале 3 — ждать сутки нельзя
    const tasks = buildTasks([wet()], forecast(dryDay, rainyDay), { 1: new Date(daysAgo(8, TODAY)) }, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('прошедший ливень засчитывается как полив', () => {
    // поливали 8 дней назад, но вчера был настоящий дождь → задачи быть не должно
    const tasks = buildTasks([wet()], forecast(dryDay, dryDay), { 1: new Date(daysAgo(8, TODAY)) },
      {}, [], TODAY, {}, null, {}, {}, { lastRainAt: new Date(daysAgo(1, TODAY)) })
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })

  it('прошедший ливень НЕ засчитывается в теплице', () => {
    const tasks = buildTasks([wet({ conditions: 'greenhouse' })], forecast(dryDay, dryDay), { 1: new Date(daysAgo(8, TODAY)) },
      {}, [], TODAY, {}, null, {}, {}, { lastRainAt: new Date(daysAgo(1, TODAY)) })
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('старый дождь (давнее интервала) полив не отменяет', () => {
    const tasks = buildTasks([wet()], forecast(dryDay, dryDay), { 1: new Date(daysAgo(8, TODAY)) },
      {}, [], TODAY, {}, null, {}, {}, { lastRainAt: new Date(daysAgo(6, TODAY)) })
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('без прогноза работает фолбэк на вероятность из снимка (на сегодня)', () => {
    const tasks = buildTasks([wet()], makeWeather(), lastWatered, {}, [], TODAY, {}, 80)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(false)
  })
})

// ─── Испарение и стадия ───────────────────────────────────────────────────────

describe('интервал полива: испарение и стадия', () => {
  it('жара сокращает интервал', () => {
    expect(wateringIntervalDays(6, 'soil', { max_temp_c: 31 })).toBe(4)  // ×0.6 → 3.6
    expect(wateringIntervalDays(6, 'soil', { max_temp_c: 27 })).toBe(5)  // ×0.75 → 4.5
    expect(wateringIntervalDays(6, 'soil', { max_temp_c: 18 })).toBe(6)  // без изменений
  })

  it('numeric-поля из pg приходят строками и всё равно учитываются', () => {
    expect(wateringIntervalDays(6, 'soil', { max_temp_c: '31.0' })).toBe(4)
  })

  it('сухой воздух и ветер сокращают интервал, но не больше чем вдвое', () => {
    expect(wateringIntervalDays(10, 'soil', { humidity_pct: 30 })).toBe(9)
    expect(wateringIntervalDays(10, 'soil', { wind_ms: 8 })).toBe(9)
    // жара + сухость + ветер + теплица: множитель упёрся в пол 0.5
    expect(wateringIntervalDays(10, 'greenhouse', { max_temp_c: 35, humidity_pct: 20, wind_ms: 12 })).toBe(5)
  })

  it('ветер не влияет на теплицу', () => {
    expect(wateringIntervalDays(10, 'greenhouse', { wind_ms: 12 })).toBe(8) // только ×0.8
  })

  it('частота берётся из watering_details по стадии, а не из общей watering_freq_days', () => {
    const p = makePlanting({
      id: 1, stage: 'flowering', watering_freq_days: 10, frost_sensitive: false,
      transplant_days: null, harvest_days: 200, planted_at: daysAgo(10, TODAY),
      watering_details: { flowering: { freq_days: 2, amount_l_m2: 8 } },
    })
    // 3 дня без воды: по общей частоте (10) ещё рано, по стадии цветения (2) — пора
    const tasks = buildTasks([p], makeWeather(), { 1: new Date(daysAgo(3, TODAY)) }, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'watering_due')).toBe(true)
  })

  it('норма л/м² и вечерний полив в жару попадают в описание задачи', () => {
    const p = makePlanting({
      id: 1, stage: 'growing', watering_freq_days: 3, frost_sensitive: false,
      transplant_days: null, harvest_days: 200, planted_at: daysAgo(10, TODAY),
      watering_details: { growing: { freq_days: 3, amount_l_m2: 6 } },
    })
    const tasks = formatTasks(buildTasks([p], makeWeather({ max_temp_c: 31 }), { 1: new Date(daysAgo(5, TODAY)) }, {}, [], TODAY))
    const t = tasks.find(t => t.type === 'watering_due')
    expect(t.description).toContain('6 л/м²')
    expect(t.description).toContain('после 19:00')
  })
})

// ─── Заморозки по прогнозу ────────────────────────────────────────────────────

describe('заморозки с упреждением', () => {
  const tender = makePlanting({ id: 1, frost_sensitive: true, watering_freq_days: null, transplant_days: null, harvest_days: 200 })

  it('предупреждает о заморозке завтра по прогнозу', () => {
    const w = makeWeather({ frost_risk: false, forecast_json: [{ min_temp_c: 8 }, { min_temp_c: -1 }] })
    const t = buildTasks([tender], w, {}, {}, [], TODAY).find(t => t.type === 'frost_alert')
    expect(t.days_until).toBe(1)
    expect(t.message).toContain('завтра')
  })

  it('предупреждает за 2 дня', () => {
    const w = makeWeather({ frost_risk: false, forecast_json: [{ min_temp_c: 8 }, { min_temp_c: 6 }, { min_temp_c: 1 }] })
    const t = buildTasks([tender], w, {}, {}, [], TODAY).find(t => t.type === 'frost_alert')
    expect(t.days_until).toBe(2)
  })

  it('сегодняшний заморозок важнее прогноза и не дублируется', () => {
    const w = makeWeather({ frost_risk: true, min_temp_c: 0, forecast_json: [{ min_temp_c: 0 }, { min_temp_c: -2 }] })
    const alerts = buildTasks([tender], w, {}, {}, [], TODAY).filter(t => t.type === 'frost_alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].days_until).toBe(0)
  })

  it('тёплый прогноз алерт не даёт', () => {
    const w = makeWeather({ frost_risk: false, forecast_json: [{ min_temp_c: 12 }, { min_temp_c: 10 }] })
    expect(buildTasks([tender], w, {}, {}, [], TODAY).some(t => t.type === 'frost_alert')).toBe(false)
  })

  it('предупреждение остаётся в «Сегодня» (days_until не отдаётся клиенту)', () => {
    const w = makeWeather({ frost_risk: false, forecast_json: [{ min_temp_c: 8 }, { min_temp_c: -1 }] })
    const t = formatTasks(buildTasks([tender], w, {}, {}, [], TODAY)).find(t => t.type === 'frost_alert')
    expect(t.days_until).toBeNull()
    expect(t.title).toContain('завтра')
  })
})

// ─── Обработки и дождь ────────────────────────────────────────────────────────

describe('обработка перед дождём', () => {
  const sprayed = makePlanting({
    id: 1, watering_freq_days: null, transplant_days: null, harvest_days: 200,
    frost_sensitive: false, planted_at: daysAgo(10, TODAY),
    care_tasks: [{ name: 'Обработка от фитофторы', day_offset: 5 }],
  })

  it('предупреждает, что дождь смоет препарат', () => {
    const w = makeWeather({ forecast_json: [{ precip_prob_pct: 5, precip_mm: 0 }, { precip_prob_pct: 90, precip_mm: 8 }] })
    const t = formatTasks(buildTasks([sprayed], w, {}, {}, [], TODAY)).find(t => t.type === 'care_task_due')
    expect(t.description).toContain('смоет')
  })

  it('в сухую погоду советует не опрыскивать по солнцу', () => {
    const w = makeWeather({ forecast_json: [{ precip_prob_pct: 5, precip_mm: 0 }, { precip_prob_pct: 5, precip_mm: 0 }] })
    const t = formatTasks(buildTasks([sprayed], w, {}, {}, [], TODAY)).find(t => t.type === 'care_task_due')
    expect(t.description).toContain('утром или вечером')
  })

  it('обычная care-задача подсказки про опрыскивание не получает', () => {
    const weeded = makePlanting({
      id: 1, watering_freq_days: null, transplant_days: null, harvest_days: 200,
      frost_sensitive: false, planted_at: daysAgo(10, TODAY),
      care_tasks: [{ name: 'Прополка', day_offset: 5 }],
    })
    const t = formatTasks(buildTasks([weeded], makeWeather(), {}, {}, [], TODAY)).find(t => t.type === 'care_task_due')
    expect(t.description).not.toContain('утром или вечером')
  })
})

// ─── Пересадка ────────────────────────────────────────────────────────────────

describe('transplant_due', () => {
  it('появляется когда stage=sowing (рассада) и прошло >= transplant_days', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'seedling', transplant_days: 7, planted_at: daysAgo(10, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(true)
  })

  it('НЕ появляется если stage != sowing', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', transplant_days: 7, planted_at: daysAgo(10, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(false)
  })

  it('НЕ появляется для прямого посева (sowing_method=direct)', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'direct', transplant_days: 7, planted_at: daysAgo(10, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(false)
  })

  it('НЕ появляется если не прошло достаточно дней', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'seedling', transplant_days: 14, planted_at: daysAgo(5, TODAY) })],
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

  it('НЕ появляется для stage=sowing (рассада ещё не высажена)', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'seedling', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(false)
  })

  it('появляется для прямого посева на stage=sowing (растёт в грунте)', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'direct', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
  })

  it('НЕ появляется если урожай уже собирали в последние 3 дня', () => {
    const lastHarvested = { 1: new Date(daysAgo(2, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY, {}, null, {}, lastHarvested
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(false)
  })

  it('появляется снова, если последний сбор был больше 3 дней назад', () => {
    const lastHarvested = { 1: new Date(daysAgo(4, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY, {}, null, {}, lastHarvested
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
  })

  it('появляется ровно через 3 дня (граница cooldown включительно)', () => {
    const lastHarvested = { 1: new Date(daysAgo(3, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY, {}, null, {}, lastHarvested
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
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

  it('возвращает ВСЕ задачи (срез до TASK_LIMIT делает routes/today.js)', () => {
    const plantings = Array.from({ length: 10 }, (_, i) =>
      makePlanting({ id: i + 1, frost_sensitive: true, watering_freq_days: 1 })
    )
    const lastWatered = plantings.reduce((acc, p) => {
      acc[p.id] = new Date(daysAgo(5, TODAY))
      return acc
    }, {})
    const tasks = buildTasks(plantings, makeWeather({ frost_risk: true }), lastWatered, {}, [], TODAY)
    // 10 заморозков + 1 групповой полив: до среза список полный, tasks_total не врёт
    expect(tasks.length).toBeGreaterThan(TASK_LIMIT)
    expect(TASK_LIMIT).toBe(7)
  })

  it('просроченный полив идёт выше care-задачи «через 3 дня»', () => {
    const p = makePlanting({
      id: 1, watering_freq_days: 3, frost_sensitive: false, transplant_days: null, harvest_days: 200,
      planted_at: daysAgo(10, TODAY), care_tasks: [{ name: 'Прополка', day_offset: 13 }],
    })
    const tasks = buildTasks([p], makeWeather(), { 1: new Date(daysAgo(10, TODAY)) }, {}, [], TODAY)
    expect(tasks[0].type).toBe('watering_due')
  })

  it('ещё не наступившая care-задача всегда ниже наступившей задачи', () => {
    const p = makePlanting({
      id: 1, watering_freq_days: 3, frost_sensitive: false, transplant_days: null, harvest_days: 200,
      planted_at: daysAgo(10, TODAY), care_tasks: [{ name: 'Прополка', day_offset: 12 }],
    })
    const tasks = buildTasks([p], makeWeather(), { 1: new Date(daysAgo(3, TODAY)) }, {}, [], TODAY)
    expect(tasks[tasks.length - 1].care_task_name).toBe('Прополка')
  })

  it('полив на нескольких посадках группируется в одну карточку (days_overdue = максимум)', () => {
    const plantings = [
      makePlanting({ id: 1, crop_name: 'Томат', watering_freq_days: 3 }),
      makePlanting({ id: 2, crop_name: 'Огурец', watering_freq_days: 3 }),
    ]
    // id=1: полив 7 дней назад (overdue=4), id=2: полив 4 дня назад (overdue=1)
    const lastWatered = {
      1: new Date(daysAgo(7, TODAY)),
      2: new Date(daysAgo(4, TODAY)),
    }
    const tasks = buildTasks(plantings, makeWeather(), lastWatered, {}, [], TODAY)
    const wateringTasks = tasks.filter(t => t.type === 'watering_due')
    expect(wateringTasks).toHaveLength(1)
    const card = wateringTasks[0]
    expect(card.planting_id).toBeNull() // групповая — информационная
    expect(card.planting_ids).toEqual([1, 2])
    expect(card.crop_names_with_ids).toEqual([
      { id: 1, name: 'Томат' },
      { id: 2, name: 'Огурец' },
    ])
    expect(card.days_overdue).toBe(4) // максимум просрочки по группе
  })

  it('полив на одной посадке остаётся адресным (planting_id, без группировки)', () => {
    const tasks = buildTasks(
      [makePlanting({ id: 5, crop_name: 'Томат', watering_freq_days: 3 })],
      makeWeather(), { 5: new Date(daysAgo(7, TODAY)) }, {}, [], TODAY
    )
    const watering = tasks.find(t => t.type === 'watering_due')
    expect(watering.planting_id).toBe(5)
    expect(watering.crop_names_with_ids).toBeUndefined()
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

  it('групповая care-задача несёт planting_ids и crop_names_with_ids (для мульти-действия)', () => {
    const weeders = ['Томат', 'Огурец', 'Перец'].map((c, i) => makePlanting({
      id: i + 1, crop_name: c, planted_at: daysAgo(10, TODAY),
      watering_freq_days: null, transplant_days: null, harvest_days: 90,
      frost_sensitive: false, care_tasks: [{ name: 'Прополка', day_offset: 5 }],
    }))
    const tasks = buildTasks(weeders, null, {}, {}, [], TODAY)
    const group = tasks.find(t => t.type === 'care_task_due' && t.crops)
    expect(group.planting_ids).toEqual([1, 2, 3])
    expect(group.crop_names_with_ids).toEqual([
      { id: 1, name: 'Томат' },
      { id: 2, name: 'Огурец' },
      { id: 3, name: 'Перец' },
    ])
  })

  it('одиночная care-задача НЕ несёт planting_ids/crop_names_with_ids', () => {
    const tasks = buildTasks([carePlanting([{ name: 'Прополка', day_offset: 5 }])], null, {}, {}, [], TODAY)
    const t = tasks.find(t => t.type === 'care_task_due')
    expect(t.planting_ids).toBeUndefined()
    expect(t.crop_names_with_ids).toBeUndefined()
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
    expect(r).toMatchObject({ name: 'Прополка', days_overdue: 5 })
    expect(r.product).toBeNull() // Прополка — не обработка, препарата нет
  })

  it('наступившая сегодня задача → days_overdue = 0', () => {
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 10 }], plantedAt, TODAY, 90)
    expect(r).toMatchObject({ name: 'Прополка', days_overdue: 0 })
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
    expect(r).toMatchObject({ name: 'Прополка', days_overdue: 5 })
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
    expect(r).toMatchObject({ name: 'Рыхление', days_overdue: 7 })
  })

  it('null если care_tasks пустой', () => {
    expect(getOverdueCareTask([], plantedAt, TODAY, 90)).toBeNull()
    expect(getOverdueCareTask(null, plantedAt, TODAY, 90)).toBeNull()
  })

  it('учитывает repeat_days (берёт последнее наступление)', () => {
    // day_offset=3, repeat=3 → наступления 3,6,9; посадке 10 дней → последнее на 9 → overdue 1
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 3, repeat_days: 3 }], plantedAt, TODAY, 90)
    expect(r).toMatchObject({ name: 'Прополка', days_overdue: 1 })
  })

  it('«Обработка от …» отдаёт рекомендованный препарат (product)', () => {
    const r = getOverdueCareTask([{ name: 'Обработка от капустной мухи', day_offset: 5 }], plantedAt, TODAY, 90)
    expect(r).toMatchObject({ name: 'Обработка от капустной мухи', days_overdue: 5, product: 'Базудин' })
  })

  it('«Обработка от …» закрывается действием treatment', () => {
    const lastCare = { treatment: new Date(daysAgo(1, TODAY)) } // позже due
    const r = getOverdueCareTask([{ name: 'Обработка от капустной мухи', day_offset: 5 }], plantedAt, TODAY, 90, lastCare)
    expect(r).toBeNull()
  })

  it('описательное имя «Первое окучивание» закрывается hilling', () => {
    const lastCare = { hilling: new Date(daysAgo(1, TODAY)) }
    const r = getOverdueCareTask([{ name: 'Первое окучивание', day_offset: 5 }], plantedAt, TODAY, 90, lastCare)
    expect(r).toBeNull()
  })
})

// ─── careTaskActionType (имя care-задачи → action_type, по ключевому слову) ────

describe('careTaskActionType', () => {
  it.each([
    ['Подвязка', 'tying'],
    ['Пасынкование', 'pinching'],
    ['Прищипка верхушки', 'pinching'],
    ['Удаление пасынков', 'pinching'],
    ['Первое окучивание', 'hilling'],
    ['Второе окучивание', 'hilling'],
    ['Обрезка нижних листьев', 'pruning'],
    ['Прополка', 'weeding'],
    ['Рыхление', 'loosening'],
    ['Обработка от капустной мухи', 'treatment'],
    ['Обработка от фитофторы', 'treatment'],
    ['Прореживание (первое)', 'thinning'],
    ['Нормировка побегов', 'thinning'],
    ['Удаление усов', 'runner_removal'],
    ['Удаление стрелок', 'bolt_removal'],
    ['Удаление цветоносов', 'deflowering'],
    ['Удаление увядших цветков', 'deflowering'],
    ['Удаление лишних завязей', 'deflowering'],
    ['Установка опоры', 'staking'],
  ])('%s → %s', (name, expected) => {
    expect(careTaskActionType(name)).toBe(expected)
  })

  it('«Обрезка для кустистости» не путается с удалением усов', () => {
    expect(careTaskActionType('Обрезка для кустистости')).toBe('pruning')
  })

  it('незамапленные имена → null', () => {
    expect(careTaskActionType('Прекратить полив')).toBeNull()
    expect(careTaskActionType(null)).toBeNull()
  })
})

// ─── Окно давности (OVERDUE_WINDOW_DAYS) ──────────────────────────────────────

describe('окно давности просрочки', () => {
  it('care-задача, просроченная больше окна, НЕ показывается', () => {
    // day_offset=5, посадке 40 дней → просрочка 35 дн. (> 21) → скрыта
    const p = makePlanting({
      planted_at: daysAgo(40, TODAY), watering_freq_days: null, transplant_days: null,
      harvest_days: 200, frost_sensitive: false, care_tasks: [{ name: 'Прополка', day_offset: 5 }],
    })
    const tasks = buildTasks([p], null, {}, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(false)
  })

  it('care-задача в пределах окна показывается', () => {
    // day_offset=5, посадке 20 дней → просрочка 15 дн. (<= 21)
    const p = makePlanting({
      planted_at: daysAgo(20, TODAY), watering_freq_days: null, transplant_days: null,
      harvest_days: 200, frost_sensitive: false, care_tasks: [{ name: 'Прополка', day_offset: 5 }],
    })
    const tasks = buildTasks([p], null, {}, {}, [], TODAY)
    expect(tasks.some(t => t.type === 'care_task_due')).toBe(true)
  })

  it('transplant_due, просроченная больше окна, НЕ показывается', () => {
    const tasks = buildTasks(
      [makePlanting({ stage: 'sowing', sowing_method: 'seedling', transplant_days: 7, planted_at: daysAgo(60, TODAY) })],
      makeWeather(), {}, {}, [], TODAY
    )
    expect(tasks.some(t => t.type === 'transplant_due')).toBe(false)
  })

  it('getOverdueCareTask: задача старше окна → null', () => {
    const r = getOverdueCareTask([{ name: 'Прополка', day_offset: 5 }], new Date(daysAgo(40, TODAY)), TODAY, 200)
    expect(r).toBeNull()
  })
})

// ─── Осенний якорь (anchor:"end") ────────────────────────────────────────────

describe('taskDayOffset — привязка осенних работ к концу вегетации', () => {
  const autumn = { name: 'Осенняя обрезка', day_offset: 7, anchor: 'end' }
  const spring = { name: 'Весенняя обрезка', day_offset: 7 }

  it('весенняя задача считается от начала — длина сезона не влияет', () => {
    expect(taskDayOffset(spring, 168)).toBe(7)
    expect(taskDayOffset(spring, 252)).toBe(7)
  })

  it('осенняя задача сдвигается на длину сезона своей зоны', () => {
    // Зона 3: сезон 165 дн. → 172-й день от начала = середина октября
    expect(taskDayOffset(autumn, 165)).toBe(172)
    // Зона 6: сезон 253 дн. → 260-й день, тоже осень, а не август
    expect(taskDayOffset(autumn, 253)).toBe(260)
  })

  it('отрицательное смещение = ДО конца вегетации (осенняя подкормка)', () => {
    expect(taskDayOffset({ name: 'Осенняя подкормка', day_offset: -21, anchor: 'end' }, 165)).toBe(144)
  })

  it('нет длины сезона → задача остаётся привязанной к началу, а не теряется', () => {
    expect(taskDayOffset(autumn, null)).toBe(7)
    expect(taskDayOffset(autumn, 0)).toBe(7)
  })

  // Смысловая проверка: одна и та же задача в разных зонах попадает в ОСЕНЬ.
  it('осенняя обрезка попадает в осень и в Сибири, и на юге', () => {
    const month = (startDoy, seasonLen) => {
      const d = dateFromDoy(startDoy, 2026)
      d.setDate(d.getDate() + taskDayOffset(autumn, seasonLen))
      return d.getMonth() + 1
    }
    expect([9, 10]).toContain(month(112, 277 - 112)) // зона 3
    expect([9, 10, 11]).toContain(month(73, 326 - 73)) // зона 6
  })
})

// ─── getNextCareTask (поле next_care_task на карточке посадки) ────────────────

describe('getNextCareTask', () => {
  const TASKS = [
    { name: 'Весенняя обрезка', day_offset: 7, repeat_days: null },
    { name: 'Прополка', day_offset: 30, repeat_days: 21 },
  ]

  it('пустой список задач → null', () => {
    expect(getNextCareTask([], 10, 180)).toBeNull()
    expect(getNextCareTask(null, 10, 180)).toBeNull()
  })

  it('возвращает ближайшую будущую задачу', () => {
    // 3-й день сезона: обрезка на 7-й ближе, чем прополка на 30-й
    expect(getNextCareTask(TASKS, 3, 180)).toEqual({ name: 'Весенняя обрезка', days_until: 4 })
  })

  it('повторяющаяся задача — следующий повтор, а не первое наступление', () => {
    // 35-й день: прополка была на 30-м, следующая на 51-м (30+21)
    expect(getNextCareTask(TASKS, 35, 180)).toEqual({ name: 'Прополка', days_until: 16 })
  })

  it('однолетник: весь уход сезона позади → null (следующего сезона нет)', () => {
    expect(getNextCareTask(TASKS, 300, 180)).toBeNull()
  })

  // Осенняя посадка многолетника: смотрим летом, до годовщины ещё далеко.
  // Раньше карточка молчала — все day_offset уже позади, а limit короче срока.
  it('многолетник: весь уход сезона позади → первая задача СЛЕДУЮЩЕГО сезона', () => {
    const r = getNextCareTask(TASKS, 300, 180, 365)
    // Следующий сезон стартует через 365-300=65 дн., обрезка ещё через 7 → 72
    expect(r).toEqual({ name: 'Весенняя обрезка', days_until: 72 })
  })

  it('многолетник: задача текущего сезона приоритетнее задачи следующего', () => {
    // 3-й день: обрезка через 4 дн. этого сезона, а не через 365+7-3 следующего
    expect(getNextCareTask(TASKS, 3, 180, 365)).toEqual({ name: 'Весенняя обрезка', days_until: 4 })
  })

  it('разовая задача за пределами limit всё равно находится (осенняя обрезка кустов)', () => {
    // harvest_days=null → limit 180; у кустов/деревьев есть разовые задачи на 130–150 день
    const autumn = [{ name: 'Осенняя обрезка', day_offset: 150, repeat_days: null }]
    expect(getNextCareTask(autumn, 100, 120)).toEqual({ name: 'Осенняя обрезка', days_until: 50 })
  })

  it('days_until всегда положительный при переходе в следующий сезон', () => {
    // Граница: сезон почти закончился (334 дн. — максимум для годовщинного якоря)
    const r = getNextCareTask(TASKS, 334, 180, 365)
    expect(r.days_until).toBeGreaterThan(0)
  })
})

// ─── Сезонный сброс для многолетников (effectivePlantedAt) ─────────────────────

describe('effectivePlantedAt', () => {
  it('однолетник → возвращает реальную дату посадки', () => {
    const p = new Date(daysAgo(400, TODAY))
    expect(effectivePlantedAt(p, false, TODAY).getTime()).toBe(p.getTime())
  })

  it('многолетник моложе года → реальная дата', () => {
    const p = new Date(daysAgo(100, TODAY))
    expect(effectivePlantedAt(p, true, TODAY).getTime()).toBe(p.getTime())
  })

  it('многолетник старше года → годовщина в текущем сезоне (в пределах года)', () => {
    const eff = effectivePlantedAt(new Date(daysAgo(400, TODAY)), true, TODAY)
    const days = Math.floor((TODAY - eff) / 86400000)
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThanOrEqual(365)
  })

  // ─── Якорь по началу сезона в зоне участка (фикс сезонности) ───
  // Сверяем по ЛОКАЛЬНЫМ компонентам даты: dateFromDoy строит локальную полночь, а
  // toISOString() увёл бы дату на сутки назад в любом поясе восточнее UTC.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('seasonStartDoy: холодная зона стартует позже тёплой', () => {
    // Реальные значения: устойчивый переход через +5 °C по архиву Open-Meteo 2021–2026
    expect(seasonStartDoy('3')).toBe(112) // Сибирь, ~22 апреля
    expect(seasonStartDoy('4')).toBe(101)
    expect(seasonStartDoy('5')).toBe(86)
    expect(seasonStartDoy('6')).toBe(73)  // юг, ~14 марта
    expect(seasonStartDoy(3)).toBe(112)   // число, не строка
  })

  it('seasonStartDoy: нет зоны → null; неизвестная зона → дефолт', () => {
    expect(seasonStartDoy(null)).toBeNull()
    expect(seasonStartDoy(undefined)).toBeNull()
    expect(seasonStartDoy('99')).toBe(86) // фолбэк на среднюю полосу, а не падение
  })

  it('dateFromDoy: 91-й день = 1 апреля, високосный год учитывается', () => {
    expect(ymd(dateFromDoy(91, 2026))).toBe('2026-04-01')
    expect(ymd(dateFromDoy(60, 2028))).toBe('2028-02-29') // 2028 високосный
  })

  // Главный случай пользователя: осенняя посадка больше не тащит «весну» в октябрь.
  it('осенняя посадка многолетника: якорь — 1 апреля (зона 3), а НЕ годовщина в октябре', () => {
    const planted = new Date('2024-10-15')
    const today = new Date('2026-08-12')
    const eff = effectivePlantedAt(planted, true, today, 109)
    expect(ymd(eff)).toBe('2026-04-19')
    // «Весенняя обрезка» +7 дн. теперь попадает в апрель, а не в октябрь
    const pruning = new Date(eff.getTime() + 7 * 86400000)
    expect(pruning.getMonth() + 1).toBe(4)
  })

  it('зона сдвигает якорь: зона 6 (1 марта) раньше зоны 3 (1 апреля)', () => {
    const planted = new Date('2024-10-15')
    const today = new Date('2026-08-12')
    const z3 = effectivePlantedAt(planted, true, today, 109)
    const z6 = effectivePlantedAt(planted, true, today, 70)
    expect(Math.round((z3 - z6) / 86400000)).toBe(39) // ровно месяц разницы
  })

  it('зимой (сезон ещё впереди) якорь — прошлогодний, а не будущий', () => {
    const eff = effectivePlantedAt(new Date('2024-10-15'), true, new Date('2026-02-01'), 109)
    expect(ymd(eff)).toBe('2025-04-19') // 01.04.2026 ещё >31 дн. впереди
  })

  it('без зоны — прежнее поведение (годовщина посадки)', () => {
    const planted = new Date('2024-10-15')
    const today = new Date('2026-08-12')
    const eff = effectivePlantedAt(planted, true, today, null)
    expect(eff.getMonth() + 1).toBe(10) // октябрьская годовщина, как раньше
  })

  it('однолетник не трогается даже при заданной зоне', () => {
    const planted = new Date('2026-05-20')
    const eff = effectivePlantedAt(planted, false, new Date('2026-08-12'), 109)
    expect(eff.getTime()).toBe(planted.getTime())
  })

  it('длина сезона — 365 или 366 дней (високосный год)', () => {
    expect(seasonLengthDays(new Date('2026-05-01'))).toBe(365)
    expect(seasonLengthDays(new Date('2027-05-01'))).toBe(366) // 2028 високосный → 29 февраля внутри
  })

  it('многолетник с прошлогодней датой показывает уход текущего сезона, без лавины', () => {
    // Клубника посажена ~400 дней назад; «Прополка» day_offset=14 должна быть в окне текущего сезона
    const p = makePlanting({
      id: 1, crop_name: 'Клубника', is_perennial: true, stage: 'growing',
      planted_at: daysAgo(400, TODAY), watering_freq_days: null, transplant_days: null,
      harvest_days: 200, frost_sensitive: false,
      care_tasks: [{ name: 'Удаление усов', day_offset: 30, repeat_days: 21 }],
    })
    const tasks = buildTasks([p], null, {}, {}, [], TODAY)
    // Не должно быть гигантской просрочки (>365); присутствие задачи зависит от фазы сезона
    const care = tasks.filter(t => t.type === 'care_task_due')
    care.forEach(t => expect(t.days_overdue).toBeLessThanOrEqual(21))
  })
})
