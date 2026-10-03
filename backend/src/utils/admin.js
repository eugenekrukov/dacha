'use strict'

/**
 * Админ ли пользователь. Сверяем по БД, а не по email из JWT: в токене email фиксируется при
 * выдаче (живёт 30 дней и не обновляется при смене адреса), а регистрация не требует
 * подтверждения почты — раньше достаточно было зарегистрировать свободный ADMIN_EMAIL.
 * Поэтому требуем: текущий email пользователя = ADMIN_EMAIL и он подтверждён кодом.
 */
async function isAdmin(db, userId) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || !userId) return false
  const r = await db.query('SELECT email, email_verified FROM users WHERE id = $1', [userId])
  const u = r.rows[0]
  return !!(u && u.email_verified && u.email &&
    u.email.toLowerCase() === adminEmail.trim().toLowerCase())
}

module.exports = { isAdmin }
