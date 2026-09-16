'use strict'

// Разовая рассылка письма-дайджеста «что сделать на участке на этой неделе» по всей базе.
// Стратегия 2026-09 (docs/strategy-2026-09.md), п. 1.7: push не доходил ни до кого, письмо —
// единственный способ проверить, возвращается ли хоть кто-то по внешнему напоминанию.
// Возврат считается по app_opens (ссылка ведёт в веб-версию) и по UTM в Метрике.
//
// Запуск (на сервере, /var/www/dacha-api/backend):
//   node scripts/send-digest.js --dry-run            # только список получателей, писем не шлёт
//   node scripts/send-digest.js --limit 1 --only <email>   # проверка на себе
//   node scripts/send-digest.js                      # боевая отправка
//
// ponytail: без таблицы «кому уже отправили» — рассылка разовая, повтор контролируется глазами
// (--dry-run показывает список). Заведём таблицу, когда дайджест станет регулярным (этап 2, п. 2.7).

const { Pool } = require('pg')
require('dotenv').config()
const { sendMail, lifecycleHtml } = require('../src/services/emailService')
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

function html(name, region, unsubUrl) {
  const where = region ? ` (${region})` : ''
  const items = TASKS.map(([t, d]) => `<li style="margin:0 0 10px"><b>${t}</b><br>${d}</li>`).join('')
  return lifecycleHtml(
    'Дела на участке на этой неделе',
    `<p>${name ? name + ', здравствуйте!' : 'Здравствуйте!'} Сентябрь${where} — время закрывать сезон,
     и от того, что сделать сейчас, зависит следующий урожай.</p>
     <ul style="padding-left:18px;margin:0">${items}</ul>
     <p style="margin-top:16px">В приложении задачи уже расставлены по вашим культурам и срокам:
     открывается на телефоне и на компьютере, вход по тому же логину.</p>
     <p style="font-size:12px;color:#888;margin-top:18px"><a href="${unsubUrl}" style="color:#888">Отписаться от писем</a></p>`,
    'Посмотреть мои задачи',
    CTA_URL
  )
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
