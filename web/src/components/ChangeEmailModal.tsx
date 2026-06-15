import { useState } from 'react'
import { api, ApiError } from '../api/client'

export default function ChangeEmailModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async () => {
    setBusy(true); setError(null)
    try {
      await api.changeEmail(email, password)
      setStep(2)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password' ? 'Неверный пароль'
          : err instanceof ApiError && err.code === 'email_taken' ? 'Этот email уже занят'
          : 'Не удалось отправить код',
      )
    } finally { setBusy(false) }
  }

  const confirm = async () => {
    setBusy(true); setError(null)
    try {
      await api.confirmEmailChange(code)
      onChanged()
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'email_taken' ? 'Этот email уже занят'
          : 'Неверный или просроченный код',
      )
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="dacha-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-black">Смена email</h2>
        {step === 1 ? (
          <>
            <input
              type="email" placeholder="Новый email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="dacha-input mb-2 w-full" autoComplete="email"
            />
            <input
              type="password" placeholder="Текущий пароль" value={password}
              onChange={(e) => setPassword(e.target.value)} className="dacha-input w-full" autoComplete="current-password"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || !email || !password} onClick={requestCode}>
                Отправить код
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-muted">Код отправлен на {email}. Введите его:</p>
            <input
              inputMode="numeric" placeholder="Код из письма" value={code}
              onChange={(e) => setCode(e.target.value)} className="dacha-input w-full"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || !code} onClick={confirm}>Подтвердить</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
