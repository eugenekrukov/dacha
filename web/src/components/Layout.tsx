import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Основная навигация (верх + низ на мобиле)
const PRIMARY = [
  { to: '/today', label: 'Сегодня' },
  { to: '/plantings', label: 'Посадки' },
  { to: '/crops', label: 'Культуры' },
  { to: '/settings', label: 'Настройки' },
]
// Дополнительная — только в верхней панели
const SECONDARY = [
  { to: '/journal', label: 'Журнал' },
  { to: '/harvests', label: 'Урожай' },
]

export default function Layout() {
  const { logout } = useAuth()
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-background/90 px-4 py-3 backdrop-blur">
        <span className="text-xl font-black text-primary">🌻 Календарь дачника</span>
        <nav className="hidden flex-wrap gap-1 sm:flex">
          {[...PRIMARY, ...SECONDARY].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `dacha-chip ${isActive ? 'dacha-chip-active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="hidden text-sm font-bold text-muted sm:block">
          Выйти
        </button>
      </header>

      <main className="flex-1 px-4 pb-24 pt-2">
        <Outlet />
      </main>

      {/* нижний нав на узких экранах */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-black/5 bg-white px-2 py-2 sm:hidden">
        {PRIMARY.map((n) => (
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
