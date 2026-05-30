'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /push-tokens — сохранить или обновить push-токен устройства
  fastify.post('/', auth, async (request, reply) => {
    const { token, platform = 'android' } = request.body
    if (!token) return reply.code(400).send({ error: 'token required' })

    await fastify.db.query(
      `INSERT INTO push_tokens (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW()`,
      [request.user.userId, token, platform]
    )
    return reply.code(204).send()
  })

  // DELETE /push-tokens — удалить токен (при выходе из аккаунта)
  fastify.delete('/', auth, async (request, reply) => {
    const { token } = request.body
    if (!token) return reply.code(400).send({ error: 'token required' })

    await fastify.db.query(
      'DELETE FROM push_tokens WHERE user_id = $1 AND token = $2',
      [request.user.userId, token]
    )
    return reply.code(204).send()
  })
}
