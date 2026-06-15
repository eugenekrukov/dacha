import { useState } from 'react'
import { api, ApiError } from '../api/client'

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password'
          ? 'Неверный текущий пароль'
          : 'Не удалось сменить пароль',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="dacha-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-black">Смена пароля</h2>
        {done ? (
          <>
            <p className="font-semibold text-tertiary">Пароль изменён.</p>
            <button className="dacha-btn mt-4 w-full" onClick={onClose}>Готово</button>
          </>
        ) : (
          <>
            <input
              type="password" placeholder="Текущий пароль" value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="dacha-input mb-2 w-full" autoComplete="current-password"
            />
            <input
              type="password" placeholder="Новый пароль (мин. 6)" value={next}
              onChange={(e) => setNext(e.target.value)}
              className="dacha-input w-full" autoComplete="new-password"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || next.length < 6 || !current} onClick={submit}>
                Сменить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
