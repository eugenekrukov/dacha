'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // PATCH /beds/:id — переименовать/сменить тип/задать размеры грядки своего участка.
  // width_cm/length_cm: null явно снимает размер (грядку разобрали/перемерили), undefined — не трогать.
  fastify.patch('/:id', auth, async (request, reply) => {
    const { name, type, width_cm, length_cm } = request.body
    if (type !== undefined && type !== 'soil' && type !== 'greenhouse') {
      return reply.code(400).send({ error: 'Invalid type' })
    }
    const bedType = type === undefined ? null : type
    const result = await fastify.db.query(
      `UPDATE garden_beds SET
         name      = COALESCE($1, name),
         type      = COALESCE($2, type),
         width_cm  = CASE WHEN $3::boolean THEN $4::integer ELSE width_cm  END,
         length_cm = CASE WHEN $5::boolean THEN $6::integer ELSE length_cm END
       WHERE id = $7 AND garden_id IN (SELECT id FROM gardens WHERE user_id = $8)
       RETURNING *`,
      [
        name ?? null, bedType,
        width_cm !== undefined, width_cm ?? null,
        length_cm !== undefined, length_cm ?? null,
        request.params.id, request.user.userId
      ]
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
