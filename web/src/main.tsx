import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { applyFontScale } from './ui/fontScale'
import './index.css'

// Применяем сохранённый размер шрифта до первого рендера (без мигания).
applyFontScale()

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
