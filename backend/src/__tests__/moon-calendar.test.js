'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

function makeMockDb() {
  return { query: async () => ({ rows: [] }) }
}

describe('GET /moon-calendar', () => {
  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).get('/moon-calendar?year=2026&month=6')
    expect(res.status).toBe(401)
    await app.close()
  })

  it('400 без year/month', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server).get('/moon-calendar').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    await app.close()
  })

  it('400 при month вне диапазона 1-12', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server).get('/moon-calendar?year=2026&month=13').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    await app.close()
  })

  it('возвращает день на каждую дату месяца + today', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server).get('/moon-calendar?year=2026&month=6').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.days).toHaveLength(30)
    expect(res.body.days[0]).toMatchObject({ date: '2026-06-01' })
    expect(res.body.today).toHaveProperty('message')
    await app.close()
  })

  it('новолуние (15.06.2026) и полнолуние (30.06.2026) помечены неблагоприятными', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server).get('/moon-calendar?year=2026&month=6').set('Authorization', `Bearer ${token}`)
    const day15 = res.body.days.find(d => d.date === '2026-06-15')
    const day30 = res.body.days.find(d => d.date === '2026-06-30')
    const day22 = res.body.days.find(d => d.date === '2026-06-22')
    expect(day15.favorable).toBe(false)
    expect(day15.label).toContain('Новолуние')
    expect(day30.favorable).toBe(false)
    expect(day30.label).toContain('Полнолуние')
    expect(day22.favorable).toBe(true)
    expect(day22.label).toBeNull()
    await app.close()
  })
})
