'use strict'

// Длительность пробного периода (дней). Сервер — источник правды по триалу.
const TRIAL_DAYS = 7

// Сколько держим подписку «подтверждённой» после синхронизации с клиента.
// Клиент синхронизирует статус при каждом запуске; если перестал (отписка/удаление) —
// окно истекает и доступ закрывается. Подписка валидируется в RuStore на клиенте.
const SUBSCRIPTION_WINDOW_DAYS = 7

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

/** Есть ли доступ к платным действиям: активный триал ИЛИ активная подписка. */
function hasAccess(user) {
  return trialInfo(user && user.trial_started_at).trial_active || isSubscribed(user && user.subscription_until)
}

module.exports = { TRIAL_DAYS, SUBSCRIPTION_WINDOW_DAYS, trialInfo, isSubscribed, hasAccess }
