'use strict'

const { translitToSlug } = require('../utils/translit')

describe('translitToSlug', () => {
  it('converts a simple crop name', () => {
    expect(translitToSlug('Томат')).toBe('tomat')
  })

  it('converts multi-word names with spaces to hyphens', () => {
    expect(translitToSlug('Капуста пекинская')).toBe('kapusta-pekinskaya')
  })

  it('handles ъ and ь as empty (no latin equivalent)', () => {
    expect(translitToSlug('Объект-подъезд')).toBe('obekt-podezd')
  })

  it('collapses repeated separators and trims edges', () => {
    expect(translitToSlug('  Лук — репчатый!!  ')).toBe('luk-repchatyy')
  })
})
