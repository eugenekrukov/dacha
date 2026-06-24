import { useState } from 'react'

const STORAGE_KEY = 'dacha_cookie_consent'

// Простое уведомление о cookie/Яндекс.Метрике — зеркало баннера на лэндинге (landing/index.html).
export default function CookieConsentBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const accept = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage недоступен — баннер просто появится повторно при следующей загрузке
    }
  }

  return (
    <div
      role="region"
      aria-label="Уведомление о cookie"
      className="dacha-card fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-wrap items-center gap-3 p-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <p className="min-w-[220px] flex-1 text-sm font-bold text-muted">
        Сайт использует cookie и Яндекс.Метрику для аналитики посещаемости. Подробнее — в{' '}
        <a href="/privacy" target="_blank" rel="noopener" className="text-link">
          политике конфиденциальности
        </a>
        .
      </p>
      <button type="button" className="dacha-btn h-auto shrink-0 px-5 py-2.5" onClick={accept}>
        Понятно
      </button>
    </div>
  )
}
