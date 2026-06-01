'use strict'

const { getZoneFromNominatim } = require('../utils/regionCoords')

// Photon (komoot) — специализированный сервис для автодополнения адресов на базе OSM.
// В отличие от Nominatim, поддерживает префиксный поиск (работает с неполными словами).
const PHOTON_URL = 'https://photon.komoot.io/api'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // GET /geocode/suggest?q=Серг
  fastify.get('/suggest', auth, async (request, reply) => {
    const { q } = request.query
    if (!q || q.trim().length < 2) return []

    try {
      // Поиск только городов и посёлков на территории РФ
      const url = `${PHOTON_URL}/?` +
        `q=${encodeURIComponent(q.trim())}` +
        `&limit=6&layer=city&countrycode=ru`

      const resp = await fetch(url, {
        headers: { 'User-Agent': 'DachaKalendar/1.0 (support@dacha.studio1008.com)' }
      })
      if (!resp.ok) return []

      const data = await resp.json()
      if (!data.features) return []

      // Убираем дубли по названию (Photon иногда возвращает один город дважды)
      const seen = new Set()
      const results = []

      for (const feature of data.features) {
        const props = feature.properties
        if (props.countrycode !== 'ru') continue

        const name = props.name
        if (!name || seen.has(name + props.state)) continue
        seen.add(name + props.state)

        const [lon, lat] = feature.geometry.coordinates
        const state = props.state || ''
        const displayParts = [name, state].filter(Boolean)
        const display = displayParts.join(', ')

        // Определяем зону из address-подобного объекта Photon
        const zone = getZoneFromNominatim({ state }) || null

        results.push({ name, display_name: display, lat, lon, zone })
      }

      return results
    } catch (err) {
      fastify.log.warn('[geocode] Photon error:', err.message)
      return []
    }
  })
}
