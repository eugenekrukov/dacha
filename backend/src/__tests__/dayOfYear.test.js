'use strict'

const { dayOfYearToDateLabel } = require('../utils/dayOfYear')

describe('dayOfYearToDateLabel', () => {
  it('returns 1 января for day 1', () => {
    expect(dayOfYearToDateLabel(1)).toBe('1 января')
  })

  it('returns 1 марта for day 60 (non-leap reference year)', () => {
    expect(dayOfYearToDateLabel(60)).toBe('1 марта')
  })

  it('returns 31 декабря for day 365', () => {
    expect(dayOfYearToDateLabel(365)).toBe('31 декабря')
  })

  it('clamps values above 365', () => {
    expect(dayOfYearToDateLabel(400)).toBe('31 декабря')
  })

  it('clamps values below 1', () => {
    expect(dayOfYearToDateLabel(0)).toBe('1 января')
  })
})
