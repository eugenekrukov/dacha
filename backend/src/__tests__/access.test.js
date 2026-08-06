'use strict'

const { hasAccess, isSubscribed, hasPromo, isLifetimePromo, LIFETIME_UNTIL, isAdSupportedStore, FREE_PLANTING_LIMIT, isPlantingLocked, freeTierState } = require('../utils/access')

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

describe('access.isPlantingLocked (read-only сверх free-набора)', () => {
  const free = { paid: false, freeIds: new Set([1, 2, 3]) }
  const paid = { paid: true, freeIds: new Set() }

  it('без подписки посадка из free-набора изменяема', () => {
    expect(isPlantingLocked(free, { id: 2, stage: 'growing' })).toBe(false)
  })

  it('без подписки посадка вне free-набора только для чтения', () => {
    expect(isPlantingLocked(free, { id: 42, stage: 'growing' })).toBe(true)
  })

  it('с платным доступом не блокируется ничего', () => {
    expect(isPlantingLocked(paid, { id: 42, stage: 'growing' })).toBe(false)
  })

  it('завершённая посадка (done) не блокируется — архив остаётся редактируемым', () => {
    expect(isPlantingLocked(free, { id: 42, stage: 'done' })).toBe(false)
  })
})

describe('access.freeTierState', () => {
  it('одним запросом отдаёт доступ и id свободных посадок', async () => {
    let captured = null
    const db = {
      query: async (sql, params) => {
        captured = { sql, params }
        return { rows: [{ subscription_until: null, promo_until: null, store: null, free_ids: [4, 5] }] }
      },
    }

    const state = await freeTierState(db, 7)

    expect(state.paid).toBe(false)
    expect([...state.freeIds]).toEqual([4, 5])
    expect(captured.params).toEqual([7, FREE_PLANTING_LIMIT])
    // Свободный набор — только активные посадки, по возрастанию id
    expect(captured.sql).toContain("stage <> 'done'")
    expect(captured.sql).toContain('ORDER BY p.id')
  })

  it('пользователь не найден → доступа нет, свободных посадок нет', async () => {
    const state = await freeTierState({ query: async () => ({ rows: [] }) }, 1)
    expect(state.paid).toBe(false)
    expect(state.freeIds.size).toBe(0)
  })
})
