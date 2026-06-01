'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /geocode/suggest?q=Серг
  // Автодополнение населённых пунктов через Nominatim OSM.
  // Возвращает до 5 подсказок для РФ.
  fastify.get('/suggest', auth, async (request, reply) => {
    const { q } = request.query
    if (!q || q.trim().length < 2) {
      return []
    }

    try {
      const query = encodeURIComponent(q.trim() + ', Россия')
      const url = `https://nominatim.openstreetmap.org/search` +
        `?q=${query}&format=json&limit=5&countrycodes=ru&accept-language=ru` +
        `&featuretype=settlement`

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'DachaKalendar/1.0 (support@dacha.studio1008.com)',
          'Accept-Language': 'ru'
        }
      })

      if (!resp.ok) return []

      const data = await resp.json()

      return data.map(item => {
        // Короткое название: берём часть до первой запятой
        const shortName = item.display_name.split(',')[0].trim()
        // Читаемое display_name: убираем "Россия" с конца
        const display = item.display_name
          .replace(/, Россия$/, '')
          .replace(/, Russia$/, '')

        return {
          name: shortName,
          display_name: display,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        }
      })
    } catch (err) {
      fastify.log.warn('[geocode] Nominatim error:', err.message)
      return []
    }
  })
}
