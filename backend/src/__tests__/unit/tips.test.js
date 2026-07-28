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

  it('прямой посев в грунт не получает советов про горшки/подоконник', () => {
    // Ни при каком дне месяца и ни при каком id посадки: «разворачивайте к свету»,
    // «досвечивайте лампой» — это про рассаду, не про грядку.
    for (const stage of ['sowing', 'sprouted', 'growing']) {
      for (let id = 0; id < 12; id++) {
        const tip = getStageTip(stage, 'direct', 30, id)
        if (tip) expect(tip).not.toMatch(/разворачивайте|досвечивайте|плёнк|Рассаде/)
      }
    }
  })

  it('рассада на подоконнике (стадия всходов) советы про досветку сохраняет', () => {
    const tips = new Set()
    for (let id = 0; id < 12; id++) tips.add(getStageTip('sprouted', 'seedling', 10, id))
    expect([...tips].some(t => /досвечивайте|светлое место/.test(t))).toBe(true)
  })

  it('стадия роста — ни одного совета про подоконник, даже у рассадного посева', () => {
    // К стадии роста рассада уже высажена в грунт: «разворачивать к свету» нечего.
    for (const method of ['seedling', 'direct']) {
      for (let id = 0; id < 24; id++) {
        expect(getStageTip('growing', method, 30, id)).not.toMatch(/разворачивайте|досвечивайте|подоконник/)
      }
    }
  })

  it('две разные посадки в один день получают разные советы', () => {
    const a = getStageTip('growing', 'seedling', 30, 1)
    const b = getStageTip('growing', 'seedling', 30, 2)
    expect(a).not.toBe(b)
  })
})
