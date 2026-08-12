'use strict'

const { refreshSeason, storedSeasonStart, storedSeasonEnd, transitionDoy } = require('../../services/seasonService')

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

describe('refreshSeason', () => {
  const garden = { id: 7, lat: 55.03, lon: 82.92 }
  const okResponse = (doy, temps) => ({
    ok: true,
    json: async () => ({ daily: series(doy, temps) }),
  })

  it('считает и сохраняет начало сезона', async () => {
    let saved = null
    const db = { query: async (sql, params) => { saved = params; return { rows: [] } } }
    const { time, temps } = series(95, [...Array(10).fill(-2), ...Array(14).fill(11)])
    const fetchFn = async () => ({ ok: true, json: async () => ({ daily: { time, temperature_2m_mean: temps } }) })

    const r = await refreshSeason(db, garden, new Date('2026-08-12'), { fetchFn })
    expect(r.start).toBe(105)
    expect(saved).toEqual([105, null, 2026, 7]) // конец сезона ещё не наступил
  })

  // Осень определима только после её наступления — ряд с падением ниже +5 в октябре.
  it('считает и конец сезона, когда осень уже прошла', async () => {
    let saved = null
    const db = { query: async (sql, params) => { saved = params; return { rows: [] } } }
    // весна: мороз с 1 марта (60), тепло с 100; осень: тепло до 280, затем холод
    const time = [], temps = []
    const d = new Date(Date.UTC(2026, 2, 1))
    for (let doy = 60; doy <= 350; doy++) {
      time.push(d.toISOString().slice(0, 10))
      temps.push(doy < 100 ? -4 : (doy < 280 ? 14 : -3))
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const fetchFn = async () => ({ ok: true, json: async () => ({ daily: { time, temperature_2m_mean: temps } }) })

    const r = await refreshSeason(db, garden, new Date('2026-12-20'), { fetchFn })
    expect(r.start).toBeGreaterThanOrEqual(99)
    expect(r.start).toBeLessThanOrEqual(103)
    expect(r.end).toBeGreaterThanOrEqual(278)
    expect(r.end).toBeLessThanOrEqual(283)
    expect(saved[3]).toBe(7) // id участка
  })

  it('до осени за её границей в сеть повторно не ходим', async () => {
    let called = 0
    const fetchFn = async () => { called++; return okResponse(95, []) }
    const g = { ...garden, season_start_doy: 105, season_start_year: 2026, season_end_doy: null }
    // Август: осень ещё не наступила (AUTUMN_ATTEMPT_FROM_DOY = 270)
    await refreshSeason({ query: async () => ({}) }, g, new Date('2026-08-12'), { fetchFn })
    expect(called).toBe(0)
  })

  it('после наступления осени возвращаемся за её датой', async () => {
    let called = 0
    const fetchFn = async () => { called++; return { ok: true, json: async () => ({ daily: { time: [], temperature_2m_mean: [] } }) } }
    const g = { ...garden, season_start_doy: 105, season_start_year: 2026, season_end_doy: null }
    await refreshSeason({ query: async () => ({}) }, g, new Date('2026-11-15'), { fetchFn })
    expect(called).toBe(1)
  })

  it('значение за этот год уже есть → в сеть не ходим', async () => {
    let called = false
    const fetchFn = async () => { called = true; return okResponse(95, []) }
    const g = { ...garden, season_start_doy: 101, season_start_year: 2026, season_end_doy: 277 }
    const doy = (await refreshSeason({ query: async () => ({}) }, g, new Date('2026-08-12'), { fetchFn })).start
    expect(doy).toBe(101)
    expect(called).toBe(false)
  })

  it('ошибка сети не роняет вызов — тихо null', async () => {
    const fetchFn = async () => { throw new Error('network down') }
    const doy = (await refreshSeason({ query: async () => ({}) }, garden, new Date('2026-08-12'), { fetchFn })).start
    expect(doy).toBeNull()
  })

  it('участок без координат → null', async () => {
    const doy = (await refreshSeason({ query: async () => ({}) }, { id: 1 }, new Date('2026-08-12'), {})).start
    expect(doy).toBeNull()
  })

  it('зимой (весна ещё не наступала) в сеть не ходим', async () => {
    let called = false
    const fetchFn = async () => { called = true; return okResponse(95, []) }
    const doy = (await refreshSeason({ query: async () => ({}) }, garden, new Date('2026-01-20'), { fetchFn })).start
    expect(doy).toBeNull()
    expect(called).toBe(false)
  })

  // Регрессия: на юге февральская оттепель давала «весну» 18 февраля при норме зоны 73.
  it('февраль в анализ не попадает — ложная весна не ловится', async () => {
    let requested = null
    const fetchFn = async (url) => {
      requested = url
      return { ok: true, json: async () => ({ daily: { time: [], temperature_2m_mean: [] } }) }
    }
    await refreshSeason({ query: async () => ({}) }, garden, new Date('2026-08-12'), { fetchFn })
    expect(requested).toContain('start_date=2026-03-01')
    expect(requested).not.toContain('02-15')
  })
})
