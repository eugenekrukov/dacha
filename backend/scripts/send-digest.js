'use strict'

// Разовая рассылка письма-дайджеста «что сделать на участке на этой неделе» по всей базе.
// Стратегия 2026-09 (docs/strategy-2026-09.md), п. 1.7: push не доходил ни до кого, письмо —
// единственный способ проверить, возвращается ли хоть кто-то по внешнему напоминанию.
// Возврат считается по app_opens (ссылка ведёт в веб-версию) и по UTM в Метрике.
//
// Запуск (на сервере, /var/www/dacha-api/backend):
//   node scripts/send-digest.js --dry-run            # только список получателей, писем не шлёт
//   node scripts/send-digest.js --preview > /tmp/d.html    # HTML письма без БД и отправки
//   node scripts/send-digest.js --limit 1 --only <email>   # проверка на себе
//   node scripts/send-digest.js                      # боевая отправка
//
// ponytail: без таблицы «кому уже отправили» — рассылка разовая, повтор контролируется глазами
// (--dry-run показывает список). Заведём таблицу, когда дайджест станет регулярным (этап 2, п. 2.7).

const { Pool } = require('pg')
require('dotenv').config()
const { sendMail } = require('../src/services/emailService')
const { buildUrl } = require('../src/utils/unsubscribe')

const CAMPAIGN = '2026-09-16-digest'
const CTA_URL = `https://calendacha.ru/app/?utm_source=email&utm_medium=digest&utm_campaign=${CAMPAIGN}`
const SUBJECT = 'Что сделать на участке на этой неделе'

// Сезонная часть письма. Сентябрь: уборка, подзимние посевы, подготовка почвы.
const TASKS = [
  ['Убрать и досушить урожай', 'Кабачки, тыквы и корнеплоды снимают до первых заморозков — подмороженные не хранятся.'],
  ['Освободить грядки и заправить почву', 'Ботву здоровых растений — в компост, больную — в костёр. Под перекопку вносят перегной и золу.'],
  ['Посеять сидераты', 'Горчица и фацелия успевают дать зелень до холодов и сами станут удобрением.'],
  ['Подкормить многолетники и деревья', 'Осенью — только фосфор и калий: азот разгонит рост, и побеги не вызреют к зиме.'],
]

// Вёрстка письма: таблицы + инлайновые стили (Mail.ru/Яндекс режут <style> и flex/grid),
// одна колонка 600px, картинок нет — письмо читается и с отключённой графикой.
const BRAND = '#FF7B00', DARK = '#2D1500', CREAM = '#FFF8EB', MUTED = '#8A7B6B'

function taskRow(i, title, body) {
  return `<tr><td style="padding:0 0 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:14px">
      <tr>
        <td width="44" valign="top" style="padding:16px 0 16px 16px">
          <div style="width:28px;height:28px;border-radius:14px;background:${BRAND};color:#fff;
                      font:bold 15px/28px Arial,sans-serif;text-align:center">${i}</div>
        </td>
        <td style="padding:16px 16px 16px 10px;font:15px/1.5 Arial,sans-serif;color:${DARK}">
          <b>${title}</b><br><span style="color:#5B4636">${body}</span>
        </td>
      </tr>
    </table>
  </td></tr>`
}

function html(name, region, unsubUrl) {
  const where = region ? `${region}, сентябрь` : 'Сентябрь'
  const hi = name ? `${name}, здравствуйте!` : 'Здравствуйте!'
  const rows = TASKS.map(([t, d], i) => taskRow(i + 1, t, d)).join('')
  return `<!doctype html><html lang="ru"><body style="margin:0;padding:0;background:#F3EDE3">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Уборка урожая, сидераты и осенняя подкормка — четыре дела, которые решают урожай следующего года.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EDE3;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden">
        <tr><td style="background:${BRAND};padding:20px 24px;font:bold 17px Arial,sans-serif;color:#fff">
          🌻 Календарь дачника
        </td></tr>
        <tr><td style="padding:24px 24px 8px;font:bold 22px/1.3 Arial,sans-serif;color:${DARK}">
          Дела на участке на этой неделе
        </td></tr>
        <tr><td style="padding:0 24px 16px;font:15px/1.6 Arial,sans-serif;color:#5B4636">
          ${hi} ${where} — время закрывать сезон. От того, что сделать сейчас, зависит урожай следующего года.
        </td></tr>
        <tr><td style="padding:0 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 8px">
          <a href="${CTA_URL}" style="background:${BRAND};color:#fff;text-decoration:none;display:inline-block;
             padding:14px 28px;border-radius:12px;font:bold 16px Arial,sans-serif">Посмотреть мои задачи</a>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;font:13px/1.5 Arial,sans-serif;color:${MUTED};text-align:center">
          Задачи уже расставлены по вашим культурам и срокам. Открывается на телефоне и на компьютере, вход по тому же логину.
        </td></tr>
        <tr><td style="border-top:1px solid #EDE3D4;padding:16px 24px;font:12px/1.6 Arial,sans-serif;color:${MUTED}">
          Вы получаете это письмо, потому что зарегистрировались в «Календаре дачника».<br>
          Мы в <a href="https://vk.ru/calendacha" style="color:${MUTED}">ВКонтакте</a>,
          <a href="https://t.me/calendacha" style="color:${MUTED}">Telegram</a> и
          <a href="https://dzen.ru/calendacha" style="color:${MUTED}">Дзене</a>.
          <a href="${unsubUrl}" style="color:${MUTED}">Отписаться от писем</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`
}

function text(name, region) {
  const where = region ? ` (${region})` : ''
  const items = TASKS.map(([t, d]) => `• ${t}. ${d}`).join('\n')
  return `${name ? name + ', здравствуйте!' : 'Здравствуйте!'}\n\nСентябрь${where} — время закрывать сезон.\n\n${items}\n\nВаши задачи по культурам и срокам: ${CTA_URL}\n`
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limit = Number(args[args.indexOf('--limit') + 1]) || null
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

  if (args.includes('--preview')) {
    process.stdout.write(html('Евгений', 'Московская область', 'https://calendacha.ru/unsubscribe?u=0&t=preview'))
    return
  }

  const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  })

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.email_verified,
            (SELECT g.region FROM gardens g WHERE g.user_id = u.id ORDER BY g.id LIMIT 1) AS region
       FROM users u
      WHERE u.is_test = false
        AND u.email_optout = false
        AND u.email_verified = true
        AND u.email IS NOT NULL
        ${only ? 'AND lower(u.email) = lower($1)' : ''}
      ORDER BY u.id`,
    only ? [only] : []
  )
  const list = limit ? rows.slice(0, limit) : rows

  console.log(`Получателей: ${list.length}${dryRun ? ' (dry-run, писем не шлём)' : ''}`)
  if (dryRun) {
    for (const u of list) console.log(`  ${u.id}\t${u.email}\t${u.email_verified ? 'verified' : 'unverified'}\t${u.region || '—'}`)
    await pool.end()
    return
  }

  let ok = 0, failed = 0
  for (const u of list) {
    const unsub = buildUrl(u.id)
    const body = html(u.name, u.region, unsub)
    try {
      await sendMail(u.email, SUBJECT, text(u.name, u.region) + `\nОтписаться: ${unsub}\n`, body)
      ok++
      console.log(`  ok   ${u.email}`)
    } catch (e) {
      failed++
      console.error(`  FAIL ${u.email}: ${e.message}`)
    }
    await new Promise((r) => setTimeout(r, 400)) // не упираться в лимит отправителя
  }
  console.log(`Отправлено: ${ok}, ошибок: ${failed}`)
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
