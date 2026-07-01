'use strict'

// Отображение "день года" → человекочитаемая дата. Не учитывает високосный год —
// используется только для показа диапазона посева на страницах /spravochnik/,
// не для расчётов (расчёты сроков остаются в recommendations.js как есть).
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function dayOfYearToDateLabel(day) {
  let remaining = Math.max(1, Math.min(365, Math.round(day)))
  for (let month = 0; month < 12; month++) {
    if (remaining <= DAYS_IN_MONTH[month]) {
      return `${remaining} ${MONTH_NAMES[month]}`
    }
    remaining -= DAYS_IN_MONTH[month]
  }
  return `31 ${MONTH_NAMES[11]}`
}

module.exports = { dayOfYearToDateLabel }
