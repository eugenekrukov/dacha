import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { applyFontScale } from './ui/fontScale'
import { api } from './api/client'
import './index.css'

// Применяем сохранённый размер шрифта до первого рендера (без мигания).
applyFontScale()

// Открытие приложения для метрики удержания: стабильный id браузера в localStorage.
// ponytail: без localStorage (приватный режим) — id на одну загрузку, такое открытие просто не свяжется с прошлыми.
function webDeviceId(): string {
  const KEY = 'dacha_device_id'
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    const id = `web-${crypto.randomUUID()}`
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
api.trackAppOpen(webDeviceId()).catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* basename = vite base ('/app' в проде, '/' в деве) */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
