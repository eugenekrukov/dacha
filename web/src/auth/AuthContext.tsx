import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import type { UserProfile } from '../api/types'
import { tokenStore } from './storage'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  startGuest: () => Promise<void>
  isGuest: boolean
  logout: () => void
  refresh: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // При старте — если есть токен, тянем профиль
  useEffect(() => {
    const token = tokenStore.getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .me()
      .then(setUser)
      .catch((err) => {
        // Токен стираем только если бэкенд явно его отверг (401/403).
        // Сетевой сбой или 5xx не разлогинивают: токен остаётся,
        // профиль подтянется при следующей загрузке страницы.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          tokenStore.clearAll()
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStore.setToken(res.token)
    tokenStore.setGuest(false)
    setUser(res.user)
  }

  // Гостевой режим: учётка без email по device_id из localStorage (повтор вернёт того же гостя).
  const startGuest = async () => {
    const res = await api.guest(tokenStore.getGuestDeviceId())
    tokenStore.setToken(res.token)
    tokenStore.setGuest(true)
    setUser(await api.me())
  }

  // Гость регистрируется через claim: та же учётка получает email и пароль, данные остаются.
  const register = async (email: string, password: string) => {
    const res = tokenStore.isGuest() ? await api.claimGuest(email, password) : await api.register(email, password)
    tokenStore.setToken(res.token)
    tokenStore.setGuest(false)
    setUser(res.user)
    // Цель Метрики "trial_start" — старт триала, для оценки рекламных кампаний
    ;(window as unknown as { ym?: (...args: unknown[]) => void }).ym?.(110118201, 'reachGoal', 'trial_start')
    // То же для VK Рекламы (пиксель Top.Mail.Ru, id 3787208) — событие настроено в кабинете VK Рекламы
    ;(window as unknown as { _tmr?: unknown[] })._tmr?.push({ type: 'reachGoal', id: 3787208, goal: 'trial_start' })
  }

  const logout = () => {
    tokenStore.clearAll()
    setUser(null)
  }

  const refresh = async () => {
    setUser(await api.me())
  }

  return (
    <AuthCtx.Provider
      value={{ user, loading, isAuthed: !!user, isGuest: !!user?.is_guest, login, register, startGuest, logout, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
