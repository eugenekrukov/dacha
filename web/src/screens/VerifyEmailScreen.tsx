import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export default function VerifyEmailScreen() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const verify = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.verifyEmail(code.trim())
      await refresh()
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? 'Неверный или просроченный код' : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await api.resendVerification()
      setResent(true)
    } catch {
      setError('Не удалось отправить код')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-black">Подтверждение email</h1>
      <p className="font-semibold text-muted">
        Мы отправили 6-значный код на {user?.email}. Введите его, чтобы подтвердить адрес.
      </p>
      <input
        className="dacha-input tracking-widest"
        placeholder="000000"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button className="dacha-btn" disabled={busy || code.length < 6} onClick={verify}>
        {busy ? '…' : 'Подтвердить'}
      </button>
      <button className="font-bold text-muted" onClick={resend} disabled={resent}>
        {resent ? 'Код отправлен повторно' : 'Отправить код ещё раз'}
      </button>
    </div>
  )
}
