'use strict'

const { getMoonPhase, getMoonPhaseFraction, getMoonIllumination, LUNAR_TIPS } = require('../data/tips')

// «Не сажать» — общепринятое правило для новолуния/полнолуния (см. getMoonPhase),
// используется уже сегодня в GET /recommendations (lunar_tip). Здесь та же классификация
// расширяется на весь месяц для календарной сетки: неблагоприятны только дни новолуния/
// полнолуния (± окно из getMoonPhase), остальные — благоприятны (растущая/убывающая луна
// подходят для разных типов работ — надземные/корнеплоды соответственно).
function dayInfo(date) {
  const phase = getMoonPhase(date)
  const noPlanting = phase === 0 || phase === 2
  return {
    date: date.toISOString().slice(0, 10),
    phaseFraction: getMoonPhaseFraction(date), // 0..1, 0/1=новолуние, 0.5=полнолуние — для иконки диска
    illumination: getMoonIllumination(date),   // 0..1
    favorable: !noPlanting,
    label: noPlanting ? LUNAR_TIPS[phase].label : null, // только для новолуния/полнолуния — предупреждающая метка в сетке
    phaseLabel: LUNAR_TIPS[phase].label,               // всегда — общее название фазы (для карточки дня)
    message: LUNAR_TIPS[phase].message,
  }
}

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /moon-calendar?year=&month=  (month: 1-12) — фазы Луны на весь месяц + сводка на сегодня.
  fastify.get('/', auth, async (request, reply) => {
    const year = parseInt(request.query.year, 10)
    const month = parseInt(request.query.month, 10)
    if (!year || !month || month < 1 || month > 12) {
      return reply.code(400).send({ error: 'year and month (1-12) required' })
    }

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const days = []
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(dayInfo(new Date(Date.UTC(year, month - 1, d, 12))))
    }

    return { days, today: dayInfo(new Date()) }
  })
}
