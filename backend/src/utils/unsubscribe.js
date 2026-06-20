'use strict'

const crypto = require('crypto')

// Подписанный токен отписки: HMAC-SHA256(userId) усечённый до 32 hex-символов.
// Бесстатусный (не храним в БД), не протухает — ссылка из старого письма продолжает работать.
// Секрет: отдельный UNSUBSCRIBE_SECRET, иначе fallback на JWT_SECRET (есть в проде).
function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'dev-unsub-secret'
}

function makeToken(userId) {
  return crypto
    .createHmac('sha256', secret())
    .update(`unsub:${userId}`)
    .digest('hex')
    .slice(0, 32)
}

/** Тайминг-безопасная проверка токена для userId. */
function verifyToken(userId, token) {
  if (!token) return false
  const expected = makeToken(userId)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(token))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Абсолютная ссылка отписки для письма. База — API-хост (там же висит роут /unsubscribe). */
function buildUrl(userId) {
  const base = (process.env.PUBLIC_API_URL || 'https://dacha.studio1008.com').replace(/\/+$/, '')
  return `${base}/unsubscribe?u=${userId}&t=${makeToken(userId)}`
}

module.exports = { makeToken, verifyToken, buildUrl }
