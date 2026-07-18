import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../api/labels'
import { isLargeFont, setLargeFont } from '../ui/fontScale'

const APP_VERSION = '1.0.0' // синхронизировать с Android versionName при релизах

// Данные аккаунта и участка переехали в «Профиль» (см. ProfileScreen AccountTab).
// «Настройки» = системные параметры: подписка, внешний вид, сведения о приложении.
export default function SettingsScreen() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [largeFont, setLarge] = useState(isLargeFont())

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
          <Link to="/paywall" className="text-link">
            Продлить подписку →
          </Link>
        )}
      </section>

      <section className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="font-black">Внешний вид</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-semibold">
            Крупный шрифт
            <span className="block text-sm font-semibold text-muted">
              Увеличивает текст по всему приложению
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={largeFont}
            aria-label="Крупный шрифт"
            onClick={() => {
              const next = !largeFont
              setLarge(next)
              setLargeFont(next)
            }}
            className={`relative h-7 w-12 shrink-0 rounded-pill transition ${
              largeFont ? 'bg-primary' : 'bg-black/15'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                largeFont ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </section>

      <section className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">О приложении</h2>
        <p className="font-semibold text-muted">Версия {APP_VERSION}</p>
        <a className="text-link" href="https://dacha.studio1008.com/offer" target="_blank" rel="noopener">
          Публичная оферта
        </a>
        <a className="text-link" href="https://dacha.studio1008.com/privacy" target="_blank" rel="noopener">
          Политика конфиденциальности
        </a>
        <a className="text-link" href="https://dacha.studio1008.com/account-deletion" target="_blank" rel="noopener">
          Удаление аккаунта и данных
        </a>
        <a className="text-link" href="mailto:dacha@studio1008.com">Поддержка: dacha@studio1008.com</a>
        <a className="text-link" href="https://vk.ru/calendacha" target="_blank" rel="noopener">
          Мы в ВКонтакте
        </a>
      </section>
    </div>
  )
}
