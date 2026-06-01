'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

// ─── Хелперы ─────────────────────────────────────────────────────────────────

const GARDEN = { id: 1, user_id: 1, name: 'Тест', lat: 55.75, lon: 37.62 }

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function makePlanting(overrides = {}) {
  return {
    id: 1,
    crop_name: 'Помидор',
    stage: 'growing',
    planted_at: daysAgo(30),
    watering_freq_days: 3,
    transplant_days: 7,
    harvest_days: 90,
    frost_sensitive: true,
    ...overrides,
  }
}

function makeWeatherRow(overrides = {}) {
  return {
    frost_risk: false,
    heat_risk: false,
    temp_c: '18',
    min_temp_c: '10',
    max_temp_c: '25',
    humidity_pct: 60,
    condition: 'clear',
    condition_text: 'Ясно',
    ...overrides,
  }
}

/**
 * Строим мок-БД который отвечает на запросы по содержимому SQL.
 * Порядок вызовов query в today.js:
 *   1. SELECT gardens
 *   2. SELECT weather_snapshots
 *   3. SELECT plantings
 *   4. SELECT action_logs (только если есть посадки)
 *   5. SELECT reminders
 */
function buildTodayMockDb({ garden = GARDEN, weather = null, plantings = [], lastActions = [], reminders = [] } = {}) {
  const calls = []
  return {
    query: async (sql) => {
      calls.push(sql.trim().split('\n')[0])  // запоминаем для отладки
      if (sql.includes('FROM gardens')) return { rows: garden ? [garden] : [] }
      if (sql.includes('FROM weather_snapshots')) return { rows: weather ? [weather] : [] }
      if (sql.includes('FROM plantings')) return { rows: plantings }
      if (sql.includes('FROM action_logs')) return { rows: lastActions }
      if (sql.includes('FROM reminders')) return { rows: reminders }
      return { rows: [] }
    },
    _calls: calls,
  }
}

// ─── Тесты ───────────────────────────────────────────────────────────────────

describe('GET /today', () => {
  let app, token

  beforeEach(async () => {
    app = await buildApp(buildTodayMockDb())
    token = makeToken(app)
  })
  afterEach(async () => app.close())

  it('400 без garden_id', async () => {
    const res = await supertest(app.server)
      .get('/today')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('401 без токена', async () => {
    const res = await supertest(app.server).get('/today?garden_id=1')
    expect(res.status).toBe(401)
  })

  it('404 для чужого участка', async () => {
    const appForeign = await buildApp(buildTodayMockDb({ garden: null }))
    const tokenForeign = makeToken(appForeign)

    const res = await supertest(appForeign.server)
      .get('/today?garden_id=99')
      .set('Authorization', `Bearer ${tokenForeign}`)

    expect(res.status).toBe(404)
    await appForeign.close()
  })

  it('weather=null если нет погодного снимка', async () => {
    const res = await supertest(app.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.weather).toBeNull()
  })

  it('tasks=[] если нет посадок', async () => {
    const res = await supertest(app.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.tasks).toEqual([])
  })

  it('возвращает погоду если снимок есть', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: false }),
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.weather).not.toBeNull()
    expect(res.body.weather).toHaveProperty('frost_risk', false)
    await localApp.close()
  })

  it('frost_alert появляется когда frost_risk=true и культура frost_sensitive', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: true }),
      plantings: [makePlanting({ frost_sensitive: true })],
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'frost_alert')).toBe(true)
    await localApp.close()
  })

  it('frost_alert НЕ появляется если культура не frost_sensitive', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: true }),
      plantings: [makePlanting({ frost_sensitive: false })],
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'frost_alert')).toBe(false)
    await localApp.close()
  })

  it('watering_due появляется когда не поливали достаточно долго', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      plantings: [makePlanting({ watering_freq_days: 3 })],
      lastActions: [],  // нет записей о поливе → считается с planted_at (30 дней назад)
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'watering_due')).toBe(true)
    await localApp.close()
  })

  it('watering_due НЕ появляется если поливали сегодня', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      plantings: [makePlanting({ watering_freq_days: 3, id: 1 })],
      lastActions: [{ planting_id: 1, logged_at: new Date().toISOString() }],
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'watering_due')).toBe(false)
    await localApp.close()
  })

  it('возвращает не более 7 задач', async () => {
    // 10 посадок с просроченным поливом и заморозками → много задач
    const plantings = Array.from({ length: 10 }, (_, i) =>
      makePlanting({ id: i + 1, frost_sensitive: true, watering_freq_days: 1 })
    )
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: true }),
      plantings,
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.length).toBeLessThanOrEqual(7)
    await localApp.close()
  })

  it('frost_alert идёт первым (priority=1)', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: true }),
      plantings: [makePlanting({ frost_sensitive: true, watering_freq_days: 1 })],
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks[0].type).toBe('frost_alert')
    await localApp.close()
  })

  it('структура ответа содержит обязательные поля', async () => {
    const res = await supertest(app.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body).toHaveProperty('garden_id')
    expect(res.body).toHaveProperty('tasks')
    expect(res.body).toHaveProperty('weather')
    expect(res.body).toHaveProperty('generated_at')
  })
})
