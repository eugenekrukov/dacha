'use strict'

// Фид блога для приложения. Публичный (как /crops, /guide) — статьи бесплатны для всех.

const { getBlogFeedItems } = require('../services/blogFeed')

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

module.exports = async function (fastify) {
  // GET /blog/feed?limit=&offset=
  fastify.get('/feed', async (request) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(request.query.limit, 10) || DEFAULT_LIMIT))
    const offset = Math.max(0, parseInt(request.query.offset, 10) || 0)
    const items = getBlogFeedItems()
    return { items: items.slice(offset, offset + limit), total: items.length }
  })
}
