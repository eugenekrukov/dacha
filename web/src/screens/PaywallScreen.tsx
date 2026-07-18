import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../api/labels'
import type { BillingPlan } from '../api/types'

// Склонение существительных по числу (1 посадка / 2 посадки / 5 посадок).
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} ${few}`
  return `${n} ${many}`
}

const PLANS: { id: BillingPlan; title: string; price: string; note: string; badge?: string }[] = [
  { id: 'yearly', title: 'Год', price: '1 990 ₽', note: '≈ 166 ₽ в месяц', badge: 'Выгодно −45%' },
  { id: 'monthly', title: 'Месяц', price: '299 ₽', note: 'оплата ежемесячно' },
]

// Что входит в «Дачник Про» сверх бесплатного тарифа (1 сад, до 3 посадок — без ограничения по времени).
const BENEFITS = [
  'Неограниченное число посадок',
  'До 30 фото на посадку вместо 3',
  'Поддержка развития приложения',
]

export default function PaywallScreen() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<BillingPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promo, setPromo] = useState('')
  const [promoMsg, setPromoMsg] = useState<string | null>(null)
  // U7: ценностный блок — показываем, что пользователь уже сделал за триал.
  const [progress, setProgress] = useState<{ plantings: number; actions: number } | null>(null)

  useEffect(() => {
    api
      .getAnalytics()
      .then((a) => setProgress({ plantings: a.plantings_count ?? 0, actions: a.total_actions ?? 0 }))
      .catch(() => {})
  }, [])

  const buy = async (plan: BillingPlan) => {
    setBusy(plan)
    setError(null)
    try {
      const res = await api.createPayment(plan)
      // Полный редирект на страницу оплаты ЮKassa; после оплаты вебхук продлит подписку,
      // пользователь вернётся на /billing/return и затем в веб-версию (статус обновится по /auth/me).
      window.location.href = res.confirmation_url
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 503
            ? 'Оплата временно недоступна'
            : err.message
          : 'Не удалось создать платёж'
      setError(msg)
      setBusy(null)
    }
  }

  const redeem = async () => {
    setPromoMsg(null)
    setError(null)
    try {
      await api.redeemPromo(promo.trim())
      await refresh()
      setPromoMsg('Промокод активирован')
      setTimeout(() => navigate('/today', { replace: true }), 1200)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      setError(
        code === 'code_already_used'
          ? 'Промокод уже использован'
          : code === 'code_expired'
            ? 'Срок действия промокода истёк'
            : 'Неверный промокод',
      )
    }
  }

  const hasAccess = user?.subscribed || user?.promo_active
  const plantingsLimit = user?.plantings_limit ?? 3

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-black">Подписка «Дачник Про»</h1>

      {hasAccess && (
        <div className="dacha-card p-4 font-semibold text-tertiary">
          {user?.subscribed
            ? `Подписка активна${user.subscription_until ? ` до ${formatDate(user.subscription_until)}` : ''}`
            : 'Доступ по промокоду активен'}
        </div>
      )}

      {!hasAccess && (
        <div className="dacha-card flex items-center gap-2 bg-tertiary/10 p-4 font-bold text-tertiary">
          <Sparkles size={20} aria-hidden className="shrink-0" />
          Бесплатно навсегда: 1 сад и до {plantingsLimit} посадок одновременно.
        </div>
      )}

      {/* U7: ценностный блок — прогресс остаётся с вами и на бесплатном тарифе */}
      {progress && (progress.plantings > 0 || progress.actions > 0) && (
        <div className="dacha-card bg-primary/10 p-4 font-semibold">
          Вы уже добавили {plural(progress.plantings, 'посадку', 'посадки', 'посадок')} и записали{' '}
          {plural(progress.actions, 'действие', 'действия', 'действий')} — всё это остаётся с вами
          и на бесплатном тарифе.
          {progress.plantings >= plantingsLimit
            ? ' Достигнут лимит одновременных посадок — «Дачник Про» снимает его.'
            : ''}
        </div>
      )}

      <section className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">Что входит</h2>
        <ul className="flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 font-semibold">
              <Check size={20} aria-hidden className="mt-0.5 shrink-0 text-tertiary" />
              {b}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm font-semibold text-muted">
        Оплата картой через ЮKassa, доступ — на оплаченный период, автосписаний нет.
      </p>

      <div className="flex flex-col gap-3">
        {PLANS.map((p) => (
          <div key={p.id} className="dacha-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="sm:flex-1">
              <div className="flex items-center gap-2 text-lg font-black">
                {p.title} · <span className="whitespace-nowrap">{p.price}</span>
                {p.badge && (
                  <span className="rounded-pill bg-tertiary px-2 py-0.5 text-xs font-black text-white">
                    {p.badge}
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold text-muted">{p.note}</div>
            </div>
            <button
              className="dacha-btn h-11 px-5"
              disabled={busy !== null}
              onClick={() => buy(p.id)}
            >
              {busy === p.id ? '…' : 'Оплатить'}
            </button>
          </div>
        ))}
      </div>

      <div className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">Есть промокод?</h2>
        <div className="flex gap-2">
          <input
            className="dacha-input"
            placeholder="DACHA-XXXX-XXXX"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <button className="dacha-btn px-5" disabled={!promo.trim()} onClick={redeem}>
            ОК
          </button>
        </div>
        {promoMsg && <p className="text-sm font-bold text-tertiary">{promoMsg}</p>}
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </div>
  )
}
