'use strict'

const supertest = require('supertest')
const Fastify = require('fastify')
const { hasAccess, isSubscribed, trialInfo, hasPromo, isLifetimePromo, LIFETIME_UNTIL, isAdSupportedStore } = require('../utils/access')

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000)
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000)

describe('access.hasAccess (логика гейта)', () => {
  it('активный триал → доступ есть', () => {
    expect(hasAccess({ trial_started_at: daysAgo(2), subscription_until: null })).toBe(true)
  })

  it('триал истёк, подписки нет → доступа нет', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: null })).toBe(false)
  })

  it('триал истёк, подписка активна → доступ есть', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: daysAhead(3) })).toBe(true)
  })

  it('подписка истекла → доступа нет', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: daysAgo(1) })).toBe(false)
  })

  it('isSubscribed: будущая дата=true, прошлая/нет=false', () => {
    expect(isSubscribed(daysAhead(1))).toBe(true)
    expect(isSubscribed(daysAgo(1))).toBe(false)
    expect(isSubscribed(null)).toBe(false)
  })

  it('trialInfo: свежий=7/active, старый=0/inactive', () => {
    expect(trialInfo(new Date())).toMatchObject({ trial_active: true, trial_days_left: 7 })
    expect(trialInfo(daysAgo(8))).toMatchObject({ trial_active: false, trial_days_left: 0 })
  })

  it('промо активно (будущая дата) → доступ есть даже без триала и подписки', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: null, promo_until: daysAhead(5) })).toBe(true)
  })

  it('промо истекло → доступа нет', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: null, promo_until: daysAgo(1) })).toBe(false)
  })

  it('hasPromo: будущая=true, прошлая/нет=false', () => {
    expect(hasPromo(daysAhead(1))).toBe(true)
    expect(hasPromo(daysAgo(1))).toBe(false)
    expect(hasPromo(null)).toBe(false)
  })

  it('isLifetimePromo: LIFETIME_UNTIL=true, обычная будущая=false', () => {
    expect(isLifetimePromo(LIFETIME_UNTIL)).toBe(true)
    expect(isLifetimePromo(daysAhead(30))).toBe(false)
    expect(isLifetimePromo(null)).toBe(false)
  })

  it('isAdSupportedStore: только samsung=true; gplay/rustore/null=false', () => {
    expect(isAdSupportedStore('samsung')).toBe(true)
    expect(isAdSupportedStore('gplay')).toBe(false)
    expect(isAdSupportedStore('rustore')).toBe(false)
    expect(isAdSupportedStore(null)).toBe(false)
  })

  it('магазин gplay с истёкшим триалом без подписки → доступа нет (платный гейт с 2026-06-13)', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: null, store: 'gplay' })).toBe(false)
  })

  it('магазин samsung → доступ есть', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), store: 'samsung' })).toBe(true)
  })

  it('магазин rustore с истёкшим триалом → доступа нет (платный гейт)', () => {
    expect(hasAccess({ trial_started_at: daysAgo(10), subscription_until: null, store: 'rustore' })).toBe(false)
  })
})

// Интеграция реального requireAccess (как в app.js) на тестовом роуте.
async function buildGated(userRow) {
  const fastify = Fastify({ logger: false })
  fastify.register(require('@fastify/jwt'), { secret: 'test-secret' })
  fastify.decorate('db', { query: async () => ({ rows: [userRow] }) })
  fastify.decorate('authenticate', async (req, reply) => { try { await req.jwtVerify() } catch (e) { reply.send(e) } })

  const { hasAccess } = require('../utils/access')
  fastify.decorate('requireAccess', async function (request, reply) {
    try { await request.jwtVerify() } catch (e) { return reply.send(e) }
    const res = await fastify.db.query('SELECT trial_started_at, subscription_until FROM users WHERE id = $1', [request.user.userId])
    if (!hasAccess(res.rows[0])) return reply.code(402).send({ error: 'subscription_required' })
  })

  fastify.post('/gated', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async () => ({ ok: true }))
  await fastify.ready()
  return fastify
}

describe('requireAccess (интеграция, 402)', () => {
  it('истёкший триал без подписки → 402', async () => {
    const app = await buildGated({ trial_started_at: daysAgo(10), subscription_until: null })
    const token = app.jwt.sign({ userId: 1, email: 't@t.com' })
    const res = await supertest(app.server).post('/gated').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(402)
    expect(res.body.error).toBe('subscription_required')
    await app.close()
  })

  it('активная подписка → 200', async () => {
    const app = await buildGated({ trial_started_at: daysAgo(10), subscription_until: daysAhead(3) })
    const token = app.jwt.sign({ userId: 1, email: 't@t.com' })
    const res = await supertest(app.server).post('/gated').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    await app.close()
  })

  it('магазин gplay с истёкшим триалом → 402 (платный гейт с 2026-06-13)', async () => {
    const app = await buildGated({ trial_started_at: daysAgo(10), subscription_until: null, store: 'gplay' })
    const token = app.jwt.sign({ userId: 1, email: 't@t.com' })
    const res = await supertest(app.server).post('/gated').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(402)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildGated({ trial_started_at: daysAgo(10), subscription_until: null })
    const res = await supertest(app.server).post('/gated')
    expect(res.status).toBe(401)
    await app.close()
  })
})
