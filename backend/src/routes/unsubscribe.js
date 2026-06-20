'use strict'

const { verifyToken } = require('../utils/unsubscribe')

// Простая HTML-страница-ответ (one-click unsubscribe открывается в браузере из письма).
function page(title, body) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:Arial,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#2D1500}
h1{color:#FF7B00;font-size:22px}p{font-size:15px;line-height:1.5;color:#444}</style>
</head><body><h1>Календарь дачника</h1>${body}</body></html>`
}

module.exports = async function (fastify) {
  // GET /unsubscribe?u=<userId>&t=<token> — отписка от информационных писем по подписанной ссылке.
  fastify.get('/', async (request, reply) => {
    const userId = parseInt(request.query.u, 10)
    const token = request.query.t

    reply.type('text/html')

    if (!userId || !verifyToken(userId, token)) {
      return reply.code(400).send(page('Ссылка недействительна',
        '<p>Ссылка отписки недействительна или устарела. Если хотите отказаться от писем, напишите нам на ' +
        '<a href="mailto:dacha@studio1008.com">dacha@studio1008.com</a>.</p>'))
    }

    await fastify.db.query('UPDATE users SET email_optout = true WHERE id = $1', [userId])

    return reply.send(page('Вы отписаны',
      '<p>Готово — вы больше не будете получать информационные письма о работе сервиса.</p>' +
      '<p style="color:#888;font-size:13px">Технические сообщения (код подтверждения, чек об оплате) ' +
      'продолжат приходить. Передумали? Напишите на ' +
      '<a href="mailto:dacha@studio1008.com">dacha@studio1008.com</a>.</p>'))
  })
}
