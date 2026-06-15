import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { api, ApiError } from '../api/client'

// Двухшаговый сброс пароля на одном экране (зеркало Android PasswordResetScreen):
// 1) запрос кода на email, 2) ввод кода + нового пароля.
type Step = 'request' | 'reset'

export default function PasswordResetScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const requestCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.forgotPassword(email.trim())
      setInfo('Если такой email зарегистрирован — мы отправили код. Проверьте почту.')
      setStep('reset')
    } catch {
      // forgot-password всегда отвечает 200; ошибка — только сеть
      setError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.resetPassword(email.trim(), code.trim(), password)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? 'Неверный или просроченный код'
          : 'Не удалось сменить пароль',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="dacha-card w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-black text-primary">Сброс пароля</h1>
        <p className="mb-6 font-semibold text-muted">
          {step === 'request'
            ? 'Введите email — пришлём код для сброса'
            : 'Введите код из письма и новый пароль'}
        </p>

        {step === 'request' ? (
          <form onSubmit={requestCode} className="flex flex-col gap-3">
            <input
              className="dacha-input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <button className="dacha-btn mt-2" disabled={busy}>
              {busy ? '…' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="flex flex-col gap-3">
            {info && <p className="text-sm font-semibold text-tertiary">{info}</p>}
            <input
              className="dacha-input"
              inputMode="numeric"
              placeholder="Код из письма"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <div className="relative">
              <input
                className="dacha-input pr-12"
                type={showPass ? 'text' : 'password'}
                placeholder="Новый пароль"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showPass ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <button className="dacha-btn mt-2" disabled={busy}>
              {busy ? '…' : 'Сменить пароль'}
            </button>
          </form>
        )}

        <Link to="/login" className="text-link mt-4 block text-center text-sm">
          Вернуться ко входу
        </Link>
      </div>
    </div>
  )
}
