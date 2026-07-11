'use strict'

const { getStageTip } = require('../../data/tips')

describe('getStageTip', () => {
  it('рассадный посев (seedling) — совет по стадии как есть, дни не важны', () => {
    expect(getStageTip('sowing', 'seedling', 1)).toBeTruthy()
    expect(getStageTip('sowing', 'seedling', 30)).toBeTruthy()
  })

  it('прямой посев (direct), стадия "sowing" и ещё не проросло — совета про плёнку нет', () => {
    expect(getStageTip('sowing', 'direct', 3)).toBeNull()
  })

  it('прямой посев (direct), стадия "sowing" застряла надолго — совет как для "growing", не "первые дни"', () => {
    const tip = getStageTip('sowing', 'direct', 14)
    expect(tip).toBeTruthy()
    expect(tip).not.toMatch(/3–5 дней|плёнк/)
  })

  it('неизвестная стадия — null', () => {
    expect(getStageTip('done', 'direct', 100)).toBeNull()
  })
})
