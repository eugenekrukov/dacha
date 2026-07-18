'use strict'

const { hasAccess, isSubscribed, hasPromo, isLifetimePromo, LIFETIME_UNTIL, isAdSupportedStore, FREE_PLANTING_LIMIT } = require('../utils/access')

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000)
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000)

describe('access.hasAccess (доступ «Дачник Про» сверх free-лимита)', () => {
  it('нет подписки/промо/рекламного магазина → доступа нет', () => {
    expect(hasAccess({ subscription_until: null })).toBe(false)
  })

  it('подписка активна → доступ есть', () => {
    expect(hasAccess({ subscription_until: daysAhead(3) })).toBe(true)
  })

  it('подписка истекла → доступа нет', () => {
    expect(hasAccess({ subscription_until: daysAgo(1) })).toBe(false)
  })

  it('isSubscribed: будущая дата=true, прошлая/нет=false', () => {
    expect(isSubscribed(daysAhead(1))).toBe(true)
    expect(isSubscribed(daysAgo(1))).toBe(false)
    expect(isSubscribed(null)).toBe(false)
  })

  it('промо активно (будущая дата) → доступ есть даже без подписки', () => {
    expect(hasAccess({ subscription_until: null, promo_until: daysAhead(5) })).toBe(true)
  })

  it('промо истекло → доступа нет', () => {
    expect(hasAccess({ subscription_until: null, promo_until: daysAgo(1) })).toBe(false)
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

  it('магазин gplay без подписки → доступа нет (платный гейт с 2026-06-13)', () => {
    expect(hasAccess({ subscription_until: null, store: 'gplay' })).toBe(false)
  })

  it('магазин samsung → доступ есть (рекламная модель, без гейта)', () => {
    expect(hasAccess({ store: 'samsung' })).toBe(true)
  })

  it('магазин rustore без подписки → доступа нет (платный гейт)', () => {
    expect(hasAccess({ subscription_until: null, store: 'rustore' })).toBe(false)
  })

  it('FREE_PLANTING_LIMIT = 3 (free-тариф: 1 сад / 3 активных посадки, бессрочно)', () => {
    expect(FREE_PLANTING_LIMIT).toBe(3)
  })
})
