'use strict'

// Одноразовое подключение пользовательского токена ВК через VK ID (для загрузки фото автопостером).
// Дальше токен обновляется сам по refresh token (services/vkIdAuth.js), пока refresh жив (180 дней
// с последнего обмена — автопостер обменивает при каждом прогоне с постами).
//
// Запуск на сервере (из backend, нужен .env с VK_ID_CLIENT_ID и доступ к БД), в два шага:
//   node scripts/vk-id-auth.js url
//     → печатает ссылку. Открыть под админом сообщества, подтвердить доступ. Браузер уйдёт на
//       VK_ID_REDIRECT_URI с ?code=…&device_id=…&state=… — скопировать адрес целиком.
//   node scripts/vk-id-auth.js exchange '<скопированный адрес>'
//     → меняет code на токены, сохраняет в vk_auth, проверяет photos.getWallUploadServer.
//
// Код живёт ~10 минут, между шагами не тянуть. Обмен делать с сервера (токен может привязаться к IP).

require('dotenv').config()
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Pool } = require('pg')
const { authPost, saveTokens, randomState } = require('../src/services/vkIdAuth')
const vkService = require('../src/services/vkService')

const PKCE_FILE = path.join(os.tmpdir(), 'dacha-vk-id-pkce.json')
const clientId = process.env.VK_ID_CLIENT_ID
const redirectUri = process.env.VK_ID_REDIRECT_URI || 'https://calendacha.ru' // без слеша: VK ID хранит redirect без него и сверяет символ в символ
const SCOPE = 'wall photos'

function stepUrl() {
  const verifier = crypto.randomBytes(48).toString('base64url') // 64 символа
  const state = randomState()
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  fs.writeFileSync(PKCE_FILE, JSON.stringify({ verifier, state }), { mode: 0o600 })
  const q = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state,
    code_challenge: challenge, code_challenge_method: 'S256', scope: SCOPE
  })
  console.log(`https://id.vk.ru/authorize?${q}`)
}

async function stepExchange(redirected) {
  const { verifier, state } = JSON.parse(fs.readFileSync(PKCE_FILE, 'utf8'))
  const p = new URL(redirected).searchParams
  if (p.get('error')) throw new Error(`VK ID отказал: ${p.get('error')} ${p.get('error_description') || ''}`)
  if (p.get('state') !== state) throw new Error('state не совпадает — начните заново с шага url')
  const deviceId = p.get('device_id')
  const data = await authPost({
    grant_type: 'authorization_code', code: p.get('code'), code_verifier: verifier,
    redirect_uri: redirectUri, client_id: clientId, device_id: deviceId, state
  })
  const db = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  })
  try {
    const token = await saveTokens(db, data, deviceId)
    fs.unlinkSync(PKCE_FILE)
    console.log(`Сохранено в vk_auth: user_id=${data.user_id}, scope="${data.scope}", expires_in=${data.expires_in}`)
    const server = await vkService.createVk({ token }).call('photos.getWallUploadServer', { group_id: process.env.VK_GROUP_ID })
    console.log(server.upload_url ? 'Проверка photos.getWallUploadServer: OK' : `Проверка: неожиданный ответ ${JSON.stringify(server)}`)
  } finally {
    await db.end()
  }
}

async function main() {
  if (!clientId) throw new Error('Задайте VK_ID_CLIENT_ID в .env')
  const [cmd, arg] = process.argv.slice(2)
  if (cmd === 'url') return stepUrl()
  if (cmd === 'exchange' && arg) return stepExchange(arg)
  console.error("Использование: node scripts/vk-id-auth.js url | exchange '<адрес после редиректа>'")
  process.exit(1)
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1) })
