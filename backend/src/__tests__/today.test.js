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
    fetched_at: new Date().toISOString(),
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
function buildTodayMockDb({ garden = GARDEN, weather = null, plantings = [], lastActions = [], reminders = [], lastRainAt = null, dismissed = [] } = {}) {
  const calls = []
  const writes = []
  return {
    query: async (sql, params) => {
      calls.push(sql.trim().split('\n')[0])  // запоминаем для отладки
      if (sql.includes('today_task_dismissals')) {
        if (sql.includes('INSERT')) { writes.push(params); return { rows: [] } }
        return { rows: dismissed.map(task_key => ({ task_key })) }
      }
      if (sql.includes('FROM gardens')) return { rows: garden ? [garden] : [] }
      // Запрос последнего дождя — тоже по weather_snapshots, отличается агрегатом
      if (sql.includes('MAX(fetched_at)')) return { rows: [{ rained_at: lastRainAt }] }
      if (sql.includes('FROM weather_snapshots')) return { rows: weather ? [weather] : [] }
      if (sql.includes('FROM plantings')) return { rows: plantings }
      if (sql.includes('FROM action_logs')) return { rows: lastActions }
      if (sql.includes('FROM reminders')) return { rows: reminders }
      return { rows: [] }
    },
    _calls: calls,
    _writes: writes,
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
    // tasks_total — полное число ДО среза (раньше считалось после и не могло быть > 7)
    expect(res.body.tasks_total).toBeGreaterThan(7)
    expect(res.body.tasks_hidden).toBe(res.body.tasks_total - res.body.tasks.length)
    await localApp.close()
  })

  it('протухший снимок погоды (старше суток) задач не рождает', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow({ frost_risk: true, fetched_at: daysAgo(2) }),
      plantings: [makePlanting({ frost_sensitive: true })],
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'frost_alert')).toBe(false)
    expect(res.body.weather).not.toBeNull() // на карточке погоду всё равно показываем
    await localApp.close()
  })

  it('прошедший ливень снимает задачу полива', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      weather: makeWeatherRow(),
      plantings: [makePlanting({ watering_freq_days: 3 })],
      lastActions: [],
      lastRainAt: daysAgo(1),
    }))
    const localToken = makeToken(localApp)

    const res = await supertest(localApp.server)
      .get('/today?garden_id=1')
      .set('Authorization', `Bearer ${localToken}`)

    expect(res.body.tasks.some(t => t.type === 'watering_due')).toBe(false)
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

// ─── Отложить / удалить задачу дня (today_task_dismissals) ───────────────────
// Задачи дня — не строки в БД (buildTasks), поэтому «отложено/удалено» фильтруется
// на сервере, чтобы Android и Web видели одинаковый список.

describe('дисмиссалы задач дня', () => {
  it('GET /today не отдаёт задачу с активным дисмиссалом', async () => {
    const localApp = await buildApp(buildTodayMockDb({
      plantings: [makePlanting({ watering_freq_days: 1 })],
    }))
    const before = await supertest(localApp.server)
      .get('/today?garden_id=1').set('Authorization', `Bearer ${makeToken(localApp)}`)
    const watering = before.body.tasks.find(t => t.type === 'watering_due')
    expect(watering).toBeTruthy()
    const key = `${watering.type}:${watering.planting_id}:${watering.crop_name}:${watering.care_task_name}`
    await localApp.close()

    const filteredApp = await buildApp(buildTodayMockDb({
      plantings: [makePlanting({ watering_freq_days: 1 })],
      dismissed: [key],
    }))
    const res = await supertest(filteredApp.server)
      .get('/today?garden_id=1').set('Authorization', `Bearer ${makeToken(filteredApp)}`)

    expect(res.body.tasks.some(t => t.type === 'watering_due')).toBe(false)
    // tasks_total считается ПОСЛЕ фильтрации, иначе «и ещё N» врёт на отложенные
    expect(res.body.tasks_total).toBe(before.body.tasks_total - 1)
    await filteredApp.close()
  })

  it('POST /tasks/dismiss: 204 и серверный target_date (snooze → +1, delete → +21)', async () => {
    const db = buildTodayMockDb()
    const localApp = await buildApp(db)
    const localToken = makeToken(localApp)

    const snooze = await supertest(localApp.server)
      .post('/today/tasks/dismiss').set('Authorization', `Bearer ${localToken}`)
      .send({ task_key: 'watering_due:1:Помидор:null', action: 'snooze' })
    expect(snooze.status).toBe(204)
    expect(db._writes[0].slice(0, 4)).toEqual([1, 'watering_due:1:Помидор:null', 'snooze', 1])

    const del = await supertest(localApp.server)
      .post('/today/tasks/dismiss').set('Authorization', `Bearer ${localToken}`)
      .send({ task_key: 'harvest_due:2:Огурец:null', action: 'delete' })
    expect(del.status).toBe(204)
    expect(db._writes[1][3]).toBe(21)  // OVERDUE_WINDOW_DAYS
    await localApp.close()
  })

  it('POST /tasks/dismiss: 400 на кривой action, пустой ключ и reminder', async () => {
    const localApp = await buildApp(buildTodayMockDb())
    const localToken = makeToken(localApp)
    const post = body => supertest(localApp.server)
      .post('/today/tasks/dismiss').set('Authorization', `Bearer ${localToken}`).send(body)

    expect((await post({ task_key: 'watering_due:1:Помидор:null', action: 'hide' })).status).toBe(400)
    expect((await post({ task_key: '', action: 'snooze' })).status).toBe(400)
    expect((await post({ task_key: 'reminder:null:null:null', action: 'delete' })).status).toBe(400)
    await localApp.close()
  })

  it('POST /tasks/dismiss: 401 без токена', async () => {
    const localApp = await buildApp(buildTodayMockDb())
    const res = await supertest(localApp.server)
      .post('/today/tasks/dismiss').send({ task_key: 'watering_due:1:x:null', action: 'snooze' })
    expect(res.status).toBe(401)
    await localApp.close()
  })

  it('GET /tasks/dismissed отдаёт активные ключи', async () => {
    const localApp = await buildApp(buildTodayMockDb({ dismissed: ['watering_due:1:Помидор:null'] }))
    const res = await supertest(localApp.server)
      .get('/today/tasks/dismissed').set('Authorization', `Bearer ${makeToken(localApp)}`)

    expect(res.status).toBe(200)
    expect(res.body.task_keys).toEqual(['watering_due:1:Помидор:null'])
    await localApp.close()
  })
})
