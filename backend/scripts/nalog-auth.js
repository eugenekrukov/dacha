'use strict'

// Одноразовая авторизация в «Мой налог» по номеру телефона + SMS.
// Сохраняет refresh_token в таблицу nalog_auth (id=1) и печатает сгенерированный device id.
// Запуск (из backend, с заполненным .env — нужен NALOG_PROXY_URL и доступ к БД):
//   node scripts/nalog-auth.js
//
// ВАЖНО: ходит к ФНС через RU-прокси (NALOG_PROXY_URL). Время на машине должно совпадать с реальным.

require('dotenv').config()
const readline = require('readline')
const crypto = require('crypto')
const fetch = require('node-fetch')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { Pool } = require('pg')

const API = process.env.NALOG_API || 'https://lknpd.nalog.ru/api/v1'

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()) }))
}

function agent() {
  if (!process.env.NALOG_PROXY_URL) throw new Error('NALOG_PROXY_URL не задан')
  return new HttpsProxyAgent(process.env.NALOG_PROXY_URL)
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
    agent: agent()
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(data)}`)
  return data
}

async function main() {
  const deviceId = process.env.NALOG_DEVICE_ID || crypto.randomBytes(11).toString('hex').slice(0, 21)
  const phone = process.env.NALOG_PHONE || await ask('Телефон (79XXXXXXXXX): ')

  const challenge = await post('/auth/challenge', { phone, requireTpToBeActive: true })
  console.log('SMS отправлено. challengeToken получен.')
  const code = await ask('Код из SMS: ')

  const deviceInfo = { appVersion: '1.0.0', sourceDeviceId: deviceId, sourceType: 'WEB', metaDetails: { userAgent: 'Mozilla/5.0' } }
  const auth = await post('/auth/challenge/verify', {
    phone,
    code,
    challengeToken: challenge.challengeToken,
    deviceInfo
  })
  if (!auth.refreshToken) throw new Error('refreshToken не получен: ' + JSON.stringify(auth))

  const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
  await pool.query(
    'UPDATE nalog_auth SET refresh_token = $1, inn = $2, updated_at = NOW() WHERE id = 1',
    [auth.refreshToken, (auth.profile && auth.profile.inn) || process.env.NALOG_INN || null]
  )
  await pool.end()

  console.log('\n✅ refresh_token сохранён в nalog_auth.')
  console.log(`Добавь в .env (если ещё нет): NALOG_DEVICE_ID=${deviceId}`)
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
