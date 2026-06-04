'use strict'

// Длительность пробного периода (дней). Сервер — источник правды по триалу.
const TRIAL_DAYS = 7

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

/** { trial_active, trial_days_left } по дате старта триала. */
function trialInfo(trialStartedAt) {
  if (!trialStartedAt) return { trial_active: false, trial_days_left: 0 }
  const daysSince = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86_400_000)
  const daysLeft = Math.max(0, TRIAL_DAYS - daysSince)
  return { trial_active: daysLeft > 0, trial_days_left: daysLeft }
}

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

/** Есть ли доступ к платным действиям: активный триал ИЛИ подписка ИЛИ промо-доступ. */
function hasAccess(user) {
  return trialInfo(user && user.trial_started_at).trial_active ||
    isSubscribed(user && user.subscription_until) ||
    hasPromo(user && user.promo_until)
}

module.exports = {
  TRIAL_DAYS, SUBSCRIPTION_WINDOW_DAYS, PROMO_MONTH_DAYS, LIFETIME_UNTIL,
  trialInfo, isSubscribed, hasPromo, isLifetimePromo, hasAccess
}
