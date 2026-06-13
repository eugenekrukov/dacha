import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const PRIMARY = [
  { to: '/today', label: 'Сегодня' },
  { to: '/plantings', label: 'Посадки' },
]
// Раздел «Информация» — выпадающее меню
const INFO = [
  { to: '/crops', label: 'Справочник культур' },
  { to: '/journal', label: 'Журнал действий' },
  { to: '/harvests', label: 'Аналитика' },
]
const SETTINGS = { to: '/settings', label: 'Настройки' }

function InfoMenu({ dropUp = false }: { dropUp?: boolean }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const active = INFO.some((i) => loc.pathname.startsWith(i.to))

  const trigger = dropUp
    ? `text-sm font-bold ${active ? 'text-primary' : 'text-muted'}`
    : `dacha-chip ${active ? 'dacha-chip-active' : ''}`

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={trigger}>
        Информация{dropUp ? ' ▴' : ' ▾'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-20 flex min-w-[190px] flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card ${
              dropUp ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'right-0 mt-1'
            }`}
          >
            {INFO.map((m) => (
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
          <InfoMenu />
          <NavLink
            to={SETTINGS.to}
            className={({ isActive }) => `dacha-chip ${isActive ? 'dacha-chip-active' : ''}`}
          >
            {SETTINGS.label}
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 px-4 pb-24 pt-2">
        <Outlet />
      </main>

      {/* нижний нав на узких экранах */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-black/5 bg-white px-2 py-2 sm:hidden">
        {PRIMARY.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `text-sm font-bold ${isActive ? 'text-primary' : 'text-muted'}`}
          >
            {n.label}
          </NavLink>
        ))}
        <InfoMenu dropUp />
        <NavLink
          to={SETTINGS.to}
          className={({ isActive }) => `text-sm font-bold ${isActive ? 'text-primary' : 'text-muted'}`}
        >
          {SETTINGS.label}
        </NavLink>
      </nav>
    </div>
  )
}
