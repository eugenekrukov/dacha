'use strict'

// Пользовательский токен ВК через VK ID (OAuth 2.1): access token живёт 1 час, refresh token — 180 дней.
// Пара хранится в vk_auth (миграция 090), первичная выдача — scripts/vk-id-auth.js.
// Документация: id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description
//
// Допущение (как в nalogService.getAccessToken): один инстанс pm2. refresh token ротируется при
// каждом обмене — два одновременных рефреша затрут пару друг друга, при нескольких воркерах нужен лок.

const crypto = require('crypto')

const AUTH_URL = 'https://id.vk.ru/oauth2/auth'
const SKEW_MS = 5 * 60000 // рефрешим заранее, чтобы токен не истёк посреди загрузки фото

const randomState = () => crypto.randomBytes(24).toString('base64url') // 32 символа a-zA-Z0-9_-

// POST form-urlencoded на id.vk.ru. Ошибки VK ID приходят как { error, error_description }.
async function authPost(params, fetchImpl = fetch) {
  const res = await fetchImpl(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`VK ID ${params.grant_type}: ${data.error || `HTTP ${res.status}`}${data.error_description ? ` — ${data.error_description}` : ''}`)
  }
  return data
}

async function saveTokens(db, data, deviceId) {
  const expiresAt = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000)
  await db.query(
    `UPDATE vk_auth SET access_token=$1, refresh_token=$2, device_id=$3, expires_at=$4, updated_at=NOW() WHERE id=1`,
    [data.access_token, data.refresh_token, deviceId, expiresAt]
  )
  return data.access_token
}

// Действующий access token или null, если VK ID ещё не подключён (нет refresh token в БД).
async function getUserToken(db, { env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const row = (await db.query('SELECT access_token, refresh_token, device_id, expires_at FROM vk_auth WHERE id=1')).rows[0]
  if (!row || !row.refresh_token) return null
  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() - SKEW_MS > now()) return row.access_token
  if (!env.VK_ID_CLIENT_ID) throw new Error('VK ID: не задан VK_ID_CLIENT_ID')
  let data
  try {
    data = await authPost({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: env.VK_ID_CLIENT_ID,
      device_id: row.device_id,
      state: randomState()
    }, fetchImpl)
  } catch (e) {
    // Протухший/отозванный refresh token — не роняем публикацию, даём вызывающему коду
    // упасть на фолбэк VK_USER_ACCESS_TOKEN. Чистим пару, чтобы не рефрешить её впустую каждый раз.
    console.error(`[vk-id-auth] рефреш не удался, сбрасываю пару: ${e.message}`)
    await db.query(
      `UPDATE vk_auth SET access_token=NULL, refresh_token=NULL, device_id=NULL, expires_at=NULL, updated_at=NOW() WHERE id=1`
    )
    return null
  }
  return saveTokens(db, data, row.device_id)
}

module.exports = { getUserToken, authPost, saveTokens, randomState, AUTH_URL }
