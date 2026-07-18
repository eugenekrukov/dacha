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

/**
 * Новая дата окончания подписки после оплаты на `days` дней.
 * Если подписка ещё активна — продлеваем от её конца (не теряем оплаченное);
 * иначе — от текущего момента.
 */
function extendSubscription(currentUntil, days) {
  const base = isSubscribed(currentUntil) ? new Date(currentUntil) : new Date()
  return new Date(base.getTime() + days * 86_400_000)
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
  revokeSubscription, isAdSupportedStore
}
