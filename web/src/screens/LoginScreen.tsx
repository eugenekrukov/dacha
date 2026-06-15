import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import Sunflower from '../ui/Sunflower'

export default function LoginScreen() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
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
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-black text-primary">
          <Sunflower size={28} /> Календарь дачника
        </h1>
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
          <div className="relative">
            <input
              className="dacha-input pr-12"
              type={showPass ? 'text' : 'password'}
              placeholder="Пароль"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

          {mode === 'login' && (
            <Link to="/reset-password" className="text-link self-end text-sm">
              Забыли пароль?
            </Link>
          )}

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
