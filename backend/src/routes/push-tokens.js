'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // POST /push-tokens — сохранить или обновить push-токен устройства.
  // provider: 'fcm' (gplay/samsung) | 'rustore' (rustore-сборка). По умолчанию rustore.
  fastify.post('/', auth, async (request, reply) => {
    const { token, platform = 'android' } = request.body
    const provider = request.body.provider === 'fcm' ? 'fcm' : 'rustore'
    if (!token) return reply.code(400).send({ error: 'token required' })

    // Токен привязан к физическому устройству: если он уже зарегистрирован за другим
    // пользователем (смена аккаунта на этом устройстве), убираем старую привязку —
    // иначе care-job будет слать пуши по чужому участку на это устройство.
    await fastify.db.query(
      'DELETE FROM push_tokens WHERE token = $1 AND user_id != $2',
      [token, request.user.userId]
    )

    await fastify.db.query(
      `INSERT INTO push_tokens (user_id, token, platform, provider, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW(), provider = EXCLUDED.provider`,
      [request.user.userId, token, platform, provider]
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
