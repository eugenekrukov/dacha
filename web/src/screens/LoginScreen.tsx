import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

export default function LoginScreen() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password)
      navigate('/today', { replace: true })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? 'Неверный email или пароль'
            : err.message
          : 'Ошибка сети'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="dacha-card w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-black text-primary">🌻 Календарь дачника</h1>
        <p className="mb-6 font-semibold text-muted">
          {mode === 'login' ? 'Вход в веб-версию' : 'Регистрация'}
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            className="dacha-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="dacha-input"
            type="password"
            placeholder="Пароль"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button className="dacha-btn mt-2" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-sm font-bold text-muted"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  )
}
