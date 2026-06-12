import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { UserProfile } from '../api/types'
import { tokenStore } from './storage'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
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
      .catch(() => tokenStore.clearAll())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStore.setToken(res.token)
    setUser(res.user)
  }

  const register = async (email: string, password: string) => {
    const res = await api.register(email, password)
    tokenStore.setToken(res.token)
    setUser(res.user)
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
      value={{ user, loading, isAuthed: !!user, login, register, logout, refresh }}
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
