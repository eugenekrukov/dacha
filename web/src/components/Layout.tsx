import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const PRIMARY = [
  { to: '/today', label: 'Сегодня' },
  { to: '/plantings', label: 'Посадки' },
]
// Раздел «Информация» — выпадающее меню
const INFO = [
  { to: '/calendar', label: 'Календарь' },
  { to: '/crops', label: 'Справочник культур' },
  { to: '/journal', label: 'Журнал действий' },
  { to: '/harvests', label: 'Аналитика' },
]
const SETTINGS = { to: '/settings', label: 'Настройки' }

// Классы ячейки нижнего нав-бара: активная — с фоном-«таблеткой», а не только цветом текста.
const bottomItem = (isActive: boolean) =>
  `mx-0.5 my-2 flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl text-[13px] font-bold transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-muted'
  }`

function InfoMenu({ dropUp = false }: { dropUp?: boolean }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const active = INFO.some((i) => loc.pathname.startsWith(i.to))

  const menu = open && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
      <div
        className={
          dropUp
            ? 'fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-xs flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card'
            : 'absolute right-0 z-30 mt-1 flex min-w-[190px] flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card'
        }
      >
        {INFO.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `rounded-btn px-3 py-2 font-bold transition hover:bg-background ${
                isActive ? 'bg-primary/10 text-primary' : 'text-[#3a2a1a]'
              }`
            }
          >
            {m.label}
          </NavLink>
        ))}
      </div>
    </>
  )

  if (dropUp) {
    return (
      <>
        <button onClick={() => setOpen((o) => !o)} className={bottomItem(active)}>
          <span>Информация</span>
          <span className="text-[9px] leading-none">▲</span>
        </button>
        {menu}
      </>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`dacha-chip ${active ? 'dacha-chip-active' : ''}`}>
        Информация ▾
      </button>
      {menu}
    </div>
  )
}

export default function Layout() {
  return (
    // h-dvh + внутренний скролл main: нижний нав — обычный flex-элемент внизу колонки,
    // а не fixed → не отрывается от низа и не зависит от динамической адресной строки.
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-background px-4 py-3">
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

      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <Outlet />
      </main>

      {/* нижний нав на узких экранах: обычный flex-элемент внизу колонки (не fixed).
          Тень-«козырёк» и граница отделяют бар от белых карточек контента. */}
      <nav className="flex h-16 shrink-0 items-stretch justify-around border-t border-black/15 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.15)] sm:hidden">
        {PRIMARY.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => bottomItem(isActive)}>
            {n.label}
          </NavLink>
        ))}
        <InfoMenu dropUp />
        <NavLink to={SETTINGS.to} className={({ isActive }) => bottomItem(isActive)}>
          {SETTINGS.label}
        </NavLink>
      </nav>
    </div>
  )
}
