'use strict'

// Сколько держим подписку «подтверждённой» после синхронизации с клиента.
// Клиент синхронизирует статус при каждом запуске; если перестал (отписка/удаление) —
// окно истекает и доступ закрывается. Подписка валидируется в RuStore на клиенте.
const SUBSCRIPTION_WINDOW_DAYS = 7

// Промокоды. lifetime → promo_until ставится в далёкое будущее (LIFETIME_UNTIL);
// month → продлевает promo_until на PROMO_MONTH_DAYS дней.
const PROMO_MONTH_DAYS = 30
const LIFETIME_UNTIL = '2999-12-31T00:00:00.000Z'
// Порог, выше которого promo_until трактуется как «навсегда» (для отображения на клиенте).
const LIFETIME_THRESHOLD = new Date('2900-01-01T00:00:00.000Z').getTime()

// Free-тариф (бессрочно, без триала, с 2026-07-18): 1 сад (и так гейтится POST /gardens
// идемпотентностью) + до FREE_PLANTING_LIMIT одновременно активных посадок (stage <> 'done').
// Выше лимита — только «Дачник Про» (requireAccess/hasAccess).
const FREE_PLANTING_LIMIT = 3

/** Активна ли подписка по серверной отметке. */
function isSubscribed(subscriptionUntil) {
  return !!subscriptionUntil && new Date(subscriptionUntil).getTime() > Date.now()
}

/** Активен ли промо-доступ по серверной отметке users.promo_until. */
function hasPromo(promoUntil) {
  return !!promoUntil && new Date(promoUntil).getTime() > Date.now()
}

/** Промо «навсегда» (lifetime) — promo_until в далёком будущем. */
function isLifetimePromo(promoUntil) {
  return hasPromo(promoUntil) && new Date(promoUntil).getTime() >= LIFETIME_THRESHOLD
}

/**
 * Магазины с рекламной моделью: доступ без 402-гейта, монетизация рекламой РСЯ. С 2026-06-13 это
 * только Samsung. gplay переведён на платную подписку (ЮKassa легальна для оплаты из РФ — Google не
 * требует Play Billing с 02.08.2022) → gplay теперь под платным гейтом, как rustore/NULL.
 */
function isAdSupportedStore(store) {
  return store === 'samsung'
}

/**
 * Есть ли доступ «Дачник Про» (сверх free-лимита): рекламный магазин (всегда) ИЛИ
 * активная подписка ИЛИ промо-доступ.
 */
function hasAccess(user) {
  return isAdSupportedStore(user && user.store) ||
    isSubscribed(user && user.subscription_until) ||
    hasPromo(user && user.promo_until)
}

// Свободный набор free-тарифа: первые FREE_PLANTING_LIMIT активных посадок пользователя (по id).
// Один и тот же SQL используют freeTierState и роуты — правило «какие посадки остаются рабочими»
// живёт в одном месте. $1 = user_id, $2 = лимит.
const FREE_SET_SQL = `
  SELECT p.id FROM plantings p
  JOIN gardens g ON g.id = p.garden_id
  WHERE g.user_id = $1 AND p.stage <> 'done'
  ORDER BY p.id
  LIMIT $2
`

/**
 * Состояние free-тарифа пользователя одним запросом: есть ли платный доступ и id посадок,
 * которые остаются изменяемыми, если доступа нет.
 */
async function freeTierState(db, userId) {
  const res = await db.query(
    `SELECT u.subscription_until, u.promo_until, u.store,
            ARRAY(${FREE_SET_SQL}) AS free_ids
     FROM users u WHERE u.id = $1`,
    [userId, FREE_PLANTING_LIMIT]
  )
  const row = res.rows[0]
  if (!row) return { paid: false, freeIds: new Set() }
  return { paid: hasAccess(row), freeIds: new Set(row.free_ids || []) }
}

/**
 * Посадка «только для чтения»? Без платного доступа изменяются лишь первые FREE_PLANTING_LIMIT
 * активных посадок; созданные сверх лимита (в период подписки) остаются видны, но неизменяемы —
 * иначе достаточно было бы оплатить один месяц в начале сезона и вести весь сезон бесплатно.
 *
 * Завершённые (stage='done') не блокируются: это архив, туда дописывают урожай после закрытия
 * сезона, и блокировка ломала бы обычный сценарий честного free-пользователя с 3 посадками.
 * ponytail: как следствие, заблокированную посадку можно перевести в 'done' и дописывать записи
 * в архив. В /today такие посадки не попадают (нет care-задач), продуктовой ценности это не даёт.
 * Если понадобится закрыть — гейтить архив отдельным правилом «done был в free-наборе».
 *
 * Вызывать ПОСЛЕ проверки владельца посадки: сюда передаётся уже свой planting.
 */
function isPlantingLocked(state, planting) {
  if (state.paid) return false
  if (!planting || planting.stage === 'done') return false
  return !state.freeIds.has(planting.id)
}

/**
 * Отмечает первый упор пользователя в free-лимит (для воронки регистрация→оплата) —
 * таймстамп ставится один раз, повторные вызовы не перезаписывают. Вызывается рядом с
 * каждым существующим 402-ответом по лимиту посадок / isPlantingLocked, саму проверку
 * не меняет — см. docs/superpowers/specs/2026-09-02-funnel-instrumentation-design.md.
 */
async function markLimitHit(db, userId) {
  await db.query('UPDATE users SET limit_hit_at = NOW() WHERE id = $1 AND limit_hit_at IS NULL', [userId])
}

/**
 * Новая дата окончания подписки после оплаты на `days` дней.
 * Продлеваем от максимума из «сейчас», текущей активной подписки и активного промо-доступа —
 * иначе оплата обрубает ещё не выгоревший промо-период (баг 2026-08-14: пользователь оплатил
 * поверх активного промокода, subscription_until встал по дате оплаты, а не суммарно).
 * promoUntil опционален — вызывающий код без промо просто не передаёт третий аргумент.
 */
function extendSubscription(currentUntil, days, promoUntil) {
  let base = Date.now()
  if (isSubscribed(currentUntil)) base = Math.max(base, new Date(currentUntil).getTime())
  if (hasPromo(promoUntil)) base = Math.max(base, new Date(promoUntil).getTime())
  return new Date(base + days * 86_400_000)
}

/**
 * Отзыв доступа при возврате средств: вычитаем выданные платежом дни из текущей даты окончания
 * (обратная операция к extendSubscription). Если результат уходит в прошлое — доступ истекает
 * (isSubscribed сравнит с now). null остаётся null (отзывать нечего).
 */
function revokeSubscription(currentUntil, days) {
  if (!currentUntil) return null
  return new Date(new Date(currentUntil).getTime() - days * 86_400_000)
}

module.exports = {
  SUBSCRIPTION_WINDOW_DAYS, PROMO_MONTH_DAYS, LIFETIME_UNTIL, FREE_PLANTING_LIMIT,
  isSubscribed, hasPromo, isLifetimePromo, hasAccess, extendSubscription,
  revokeSubscription, isAdSupportedStore, freeTierState, isPlantingLocked, markLimitHit
}
