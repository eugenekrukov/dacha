import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../api/labels'

export default function SettingsScreen() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusText = user?.subscribed
    ? `Подписка активна${user.subscription_until ? ` до ${formatDate(user.subscription_until)}` : ''}`
    : user?.promo_active
      ? user.promo_lifetime
        ? 'Промокод активен (навсегда)'
        : `Промокод активен${user.promo_until ? ` до ${formatDate(user.promo_until)}` : ''}`
      : user?.trial_active
        ? `Пробный период: осталось ${user.trial_days_left ?? 0} дн.`
        : 'Доступ неактивен'

  const cancelAutoRenew = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.cancelAutoRenew()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отключить автопродление')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Настройки</h1>

      <section className="dacha-card flex flex-col gap-1 p-5">
        <h2 className="font-black">Аккаунт</h2>
        <p className="font-semibold text-muted">{user?.email}</p>
        {user && user.email_verified === false && (
          <Link to="/verify-email" className="mt-1 font-bold text-primary">
            ✉ Подтвердите email →
          </Link>
        )}
      </section>

      <section className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="font-black">Подписка</h2>
        <p className="font-semibold text-tertiary">{statusText}</p>
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        {!user?.subscribed && (
          <Link to="/paywall" className="dacha-btn flex items-center justify-center">
            {user?.trial_active || user?.promo_active ? 'Оформить подписку' : 'Продлить доступ'}
          </Link>
        )}
        {user?.subscribed && user?.auto_renew && (
          <button className="dacha-chip py-3" disabled={busy} onClick={cancelAutoRenew}>
            Отключить автопродление
          </button>
        )}
        {user?.subscribed && !user?.auto_renew && (
          <Link to="/paywall" className="font-bold text-primary">
            Продлить подписку →
          </Link>
        )}
      </section>

      <button
        className="dacha-chip py-3 font-bold text-red-600"
        onClick={() => {
          logout()
          navigate('/login', { replace: true })
        }}
      >
        Выйти из аккаунта
      </button>
    </div>
  )
}
