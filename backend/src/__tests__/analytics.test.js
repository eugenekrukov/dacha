'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

function makeMockDb({ activityRows = [], allDaysRows = [], totals = {}, onboarding = {} } = {}) {
  const defaults = { total_actions: 0, total_harvests: 0 }
  const onbDefaults = { has_garden: false, has_planting: false, has_action: false, has_harvest: false }
  let callCount = 0
  return {
    query: async () => {
      callCount++
      if (callCount === 1) return { rows: activityRows }
      if (callCount === 2) return { rows: allDaysRows }
      if (callCount === 3) return { rows: [{ ...defaults, ...totals }] }
      return { rows: [{ ...onbDefaults, ...onboarding }] }
    },
  }
}

describe('GET /analytics/summary', () => {
  it('возвращает структуру с обязательными полями', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('streak')
    expect(res.body).toHaveProperty('total_actions')
    expect(res.body).toHaveProperty('total_harvests')
    expect(res.body).toHaveProperty('activity_by_day')
    expect(res.body).toHaveProperty('onboarding')
    await app.close()
  })

  it('возвращает total_actions и total_harvests из БД', async () => {
    const app = await buildApp(makeMockDb({ totals: { total_actions: 5, total_harvests: 2 } }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.total_actions).toBe(5)
    expect(res.body.total_harvests).toBe(2)
    await app.close()
  })

  it('streak=0 если нет активности', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.streak).toBe(0)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).get('/analytics/summary')
    expect(res.status).toBe(401)
    await app.close()
  })
})
