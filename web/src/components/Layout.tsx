import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Основные пункты (в шапке и в нижнем навбаре на мобиле)
const PRIMARY = [
  { to: '/today', label: 'Сегодня' },
  { to: '/plantings', label: 'Посадки' },
  { to: '/crops', label: 'Культуры' },
]
// Вторичные — в выпадающем «Ещё» (на мобиле доступны со страницы Настроек)
const MORE = [
  { to: '/journal', label: 'Журнал' },
  { to: '/harvests', label: 'Урожай' },
]
const SETTINGS = { to: '/settings', label: 'Настройки' }

function MoreMenu() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const active = MORE.some((m) => loc.pathname.startsWith(m.to))
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`dacha-chip ${active ? 'dacha-chip-active' : ''}`}
      >
        Ещё ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 flex min-w-[150px] flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card">
            {MORE.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-btn px-3 py-2 font-bold transition hover:bg-background ${
                    isActive ? 'text-primary' : 'text-[#3a2a1a]'
                  }`
                }
              >
                {m.label}
              </NavLink>
            ))}
            <div className="my-1 border-t border-black/5" />
            <button
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
              className="rounded-btn px-3 py-2 text-left font-bold text-red-600 transition hover:bg-background"
            >
              Выйти
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background/90 px-4 py-3 backdrop-blur">
        <span className="shrink-0 whitespace-nowrap text-lg font-black text-primary sm:text-xl">
          🌻 Календарь дачника
        </span>
        <nav className="hidden items-center gap-1 sm:flex">
          {PRIMARY.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `dacha-chip ${isActive ? 'dacha-chip-active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
          <NavLink
            to={SETTINGS.to}
            className={({ isActive }) => `dacha-chip ${isActive ? 'dacha-chip-active' : ''}`}
          >
            {SETTINGS.label}
          </NavLink>
          <MoreMenu />
        </nav>
      </header>

      <main className="flex-1 px-4 pb-24 pt-2">
        <Outlet />
      </main>

      {/* нижний нав на узких экранах */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-black/5 bg-white px-2 py-2 sm:hidden">
        {[...PRIMARY, SETTINGS].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `text-sm font-bold ${isActive ? 'text-primary' : 'text-muted'}`}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
