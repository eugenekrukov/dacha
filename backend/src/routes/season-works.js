'use strict'

// GET /season-works?garden_id= — «Работы на этой неделе в вашем регионе» (стратегия 2026-09, п. 2.3).
// Контент и отбор — data/seasonalWorks.js; здесь только сезон участка и его культуры.

const { worksForWeek } = require('../data/seasonalWorks')
const { seasonStartDoy, seasonEndDoy } = require('../utils/todayLogic')
const { getZoneForRegion } = require('../utils/regionCoords')
const { storedSeasonStart, storedSeasonEnd } = require('../services/seasonService')

const SITE = 'https://calendacha.ru'

module.exports = async function (fastify) {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    schema: { querystring: { type: 'object', required: ['garden_id'], properties: { garden_id: { type: 'integer' } } } },
  }, async (request, reply) => {
    const { garden_id } = request.query
    const db = fastify.db
    const gardenRes = await db.query('SELECT * FROM gardens WHERE id=$1 AND user_id=$2', [garden_id, request.user.userId])
    const garden = gardenRes.rows[0]
    if (!garden) return reply.code(404).send({ error: 'Garden not found' })

    const today = new Date()
    const zone = garden.climate_zone || getZoneForRegion(garden.region)
    // Фактическая весна/осень этого года (weatherJob → seasonService), иначе норма зоны.
    const seasonStart = storedSeasonStart(garden, today) ?? seasonStartDoy(zone)
    const seasonEnd = storedSeasonEnd(garden, today) ?? seasonEndDoy(zone)

    const cropsRes = await db.query(
      `SELECT DISTINCT c.name FROM plantings p JOIN crops c ON c.id = p.crop_id
       WHERE p.garden_id = $1 AND p.stage <> 'done'`,
      [garden_id]
    )
    const gardenCrops = new Set(cropsRes.rows.map(r => r.name))

    const items = worksForWeek({ today, seasonStart, seasonEnd, zone, gardenCrops })

    // Ссылка на справочник — по slug культуры (одним запросом на все культуры выдачи).
    const cropNames = [...new Set(items.map(i => i.crop).filter(Boolean))]
    const slugs = new Map()
    if (cropNames.length) {
      const r = await db.query('SELECT name, slug FROM crops WHERE name = ANY($1)', [cropNames])
      r.rows.forEach(row => row.slug && slugs.set(row.name, row.slug))
    }

    return {
      region: garden.city || garden.region || null,
      items: items.map(i => ({ ...i, link: slugs.has(i.crop) ? `${SITE}/spravochnik/kultury/${slugs.get(i.crop)}/` : null })),
    }
  })
}
