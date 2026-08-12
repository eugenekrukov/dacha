'use strict'

const { refreshSeasonStart, storedSeasonStart, transitionDoy } = require('../../services/seasonService')

// Ряд среднесуточных: зима до дня N, потом устойчивое тепло.
function series(startDoy, temps) {
  const time = []
  const d = new Date(Date.UTC(2026, 0, 1))
  d.setUTCDate(startDoy)
  for (let i = 0; i < temps.length; i++) {
    time.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return { time, temps }
}

describe('transitionDoy — устойчивый переход через +5 °C', () => {
  // Проверяем СМЫСЛ (дата попала в потепление, а не в мороз), а не точную арифметику окна:
  // сглаживание неизбежно сдвигает результат на день-два, и пиннинг точного числа делал бы
  // тест хрупким без пользы.
  it('дата перехода лежит рядом с реальным потеплением, а не в морозе', () => {
    // мороз дни 90–99, устойчивое тепло с дня 100
    const { time, temps } = series(90, [...Array(10).fill(-3), ...Array(14).fill(10)])
    const doy = transitionDoy(time, temps)
    expect(doy).toBeGreaterThanOrEqual(99)
    expect(doy).toBeLessThanOrEqual(102)
  })

  it('центрированное окно не даёт вернуть дату РАНЬШЕ потепления', () => {
    // Ключевая регрессия: при окне «вперёд» возвращался день, когда ещё стоял мороз.
    const { time, temps } = series(95, [...Array(10).fill(-2), ...Array(14).fill(11)])
    expect(transitionDoy(time, temps)).toBeGreaterThanOrEqual(104) // тепло с дня 105
  })

  it('одиночная оттепель НЕ считается переходом (сглаживание 7 дней)', () => {
    const { time, temps } = series(90, [-5, -5, 20, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5])
    expect(transitionDoy(time, temps)).toBeNull()
  })

  it('возврат холодов после тепла не отодвигает уже случившийся переход', () => {
    // тепло с дня 103, короткий возврат холода на 110–111, снова тепло
    const { time, temps } = series(100, [
      -5, -5, -5, ...Array(7).fill(8), -2, -2, ...Array(7).fill(12),
    ])
    const doy = transitionDoy(time, temps)
    expect(doy).toBeLessThan(110) // не уехал за похолодание
  })

  it('весна ещё не наступила → null', () => {
    const { time, temps } = series(60, Array(30).fill(-10))
    expect(transitionDoy(time, temps)).toBeNull()
  })

  it('данных меньше окна сглаживания → null, а не падение', () => {
    expect(transitionDoy([], [])).toBeNull()
    const { time, temps } = series(90, [10, 10])
    expect(transitionDoy(time, temps)).toBeNull()
  })

  it('пропуски в ряду (null) не ломают расчёт', () => {
    const { time, temps } = series(90, [null, null, ...Array(12).fill(9)])
    expect(transitionDoy(time, temps)).not.toBeNull()
  })
})

describe('storedSeasonStart — актуальность сохранённого значения', () => {
  const today = new Date('2026-08-12')

  it('значение за текущий год используется', () => {
    expect(storedSeasonStart({ season_start_doy: 105, season_start_year: 2026 }, today)).toBe(105)
  })

  it('прошлогоднее значение протухло → null (возьмут норму по зоне)', () => {
    expect(storedSeasonStart({ season_start_doy: 105, season_start_year: 2025 }, today)).toBeNull()
  })

  it('нет значения → null', () => {
    expect(storedSeasonStart({}, today)).toBeNull()
    expect(storedSeasonStart(null, today)).toBeNull()
  })
})

describe('refreshSeasonStart', () => {
  const garden = { id: 7, lat: 55.03, lon: 82.92 }
  const okResponse = (doy, temps) => ({
    ok: true,
    json: async () => ({ daily: series(doy, temps) }),
  })

  it('считает и сохраняет день перехода', async () => {
    let saved = null
    const db = { query: async (sql, params) => { saved = params; return { rows: [] } } }
    const { time, temps } = series(95, [...Array(10).fill(-2), ...Array(14).fill(11)])
    const fetchFn = async () => ({ ok: true, json: async () => ({ daily: { time, temperature_2m_mean: temps } }) })

    const doy = await refreshSeasonStart(db, garden, new Date('2026-08-12'), { fetchFn })
    expect(doy).toBe(105)
    expect(saved).toEqual([105, 2026, 7])
  })

  it('значение за этот год уже есть → в сеть не ходим', async () => {
    let called = false
    const fetchFn = async () => { called = true; return okResponse(95, []) }
    const g = { ...garden, season_start_doy: 101, season_start_year: 2026 }
    const doy = await refreshSeasonStart({ query: async () => ({}) }, g, new Date('2026-08-12'), { fetchFn })
    expect(doy).toBe(101)
    expect(called).toBe(false)
  })

  it('ошибка сети не роняет вызов — тихо null', async () => {
    const fetchFn = async () => { throw new Error('network down') }
    const doy = await refreshSeasonStart({ query: async () => ({}) }, garden, new Date('2026-08-12'), { fetchFn })
    expect(doy).toBeNull()
  })

  it('участок без координат → null', async () => {
    const doy = await refreshSeasonStart({ query: async () => ({}) }, { id: 1 }, new Date('2026-08-12'), {})
    expect(doy).toBeNull()
  })

  it('зимой (весна ещё не наступала) в сеть не ходим', async () => {
    let called = false
    const fetchFn = async () => { called = true; return okResponse(95, []) }
    const doy = await refreshSeasonStart({ query: async () => ({}) }, garden, new Date('2026-01-20'), { fetchFn })
    expect(doy).toBeNull()
    expect(called).toBe(false)
  })
})
