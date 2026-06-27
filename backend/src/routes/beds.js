'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // PATCH /beds/:id — переименовать/сменить тип грядки своего участка
  fastify.patch('/:id', auth, async (request, reply) => {
    const { name, type } = request.body
    const bedType = type === undefined ? null : (type === 'greenhouse' ? 'greenhouse' : 'soil')
    const result = await fastify.db.query(
      `UPDATE garden_beds SET name = COALESCE($1, name), type = COALESCE($2, type)
       WHERE id = $3 AND garden_id IN (SELECT id FROM gardens WHERE user_id = $4)
       RETURNING *`,
      [name ?? null, bedType, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Bed not found' })
    return result.rows[0]
  })

  // DELETE /beds/:id — посадки, привязанные к грядке, не удаляются (ON DELETE SET NULL)
  fastify.delete('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `DELETE FROM garden_beds WHERE id = $1
       AND garden_id IN (SELECT id FROM gardens WHERE user_id = $2)
       RETURNING id`,
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Bed not found' })
    return reply.code(200).send({ deleted: true })
  })
}
