import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Sun,
  Sprout,
  CalendarDays,
  BookOpen,
  MoreHorizontal,
  NotebookPen,
  BarChart3,
  ShieldAlert,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import Sunflower from '../ui/Sunflower'

type Item = { to: string; label: string; icon: LucideIcon }

// Частые разделы — на виду (верхний ряд / нижний бар).
const PRIMARY: Item[] = [
  { to: '/today', label: 'Сегодня', icon: Sun },
  { to: '/plantings', label: 'Посадки', icon: Sprout },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/crops', label: 'Справочник', icon: BookOpen },
]
// Редкие разделы — под «Ещё».
const MORE: Item[] = [
  { to: '/journal', label: 'Журнал действий', icon: NotebookPen },
  { to: '/harvests', label: 'Аналитика', icon: BarChart3 },
  { to: '/guide', label: 'Болезни и дефициты', icon: ShieldAlert },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

const bottomItem = (isActive: boolean) =>
  `mx-0.5 my-1.5 flex flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl text-[11px] font-bold transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-muted'
  }`

function MoreMenu({ dropUp = false }: { dropUp?: boolean }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const active = MORE.some((i) => loc.pathname.startsWith(i.to))

  const menu = open && (
    <>
      <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
      <div
        className={
          dropUp
            ? 'fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-xs flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card'
            : 'absolute right-0 z-30 mt-1 flex min-w-[210px] flex-col gap-1 rounded-card border border-black/10 bg-white p-2 shadow-card'
        }
      >
        {MORE.map((m) => {
          const Icon = m.icon
          return (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-btn px-3 py-2 font-bold transition hover:bg-background ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-[#3a2a1a]'
                }`
              }
            >
              <Icon size={18} aria-hidden /> {m.label}
            </NavLink>
          )
        })}
      </div>
    </>
  )

  if (dropUp) {
    return (
      <>
        <button onClick={() => setOpen((o) => !o)} className={bottomItem(active)}>
          <MoreHorizontal size={20} aria-hidden />
          <span>Ещё</span>
        </button>
        {menu}
      </>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`dacha-chip flex items-center gap-1.5 ${active ? 'dacha-chip-active' : ''}`}
      >
        <MoreHorizontal size={18} aria-hidden /> Ещё
      </button>
      {menu}
    </div>
  )
}

export default function Layout() {
  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-background px-4 py-3">
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-black text-primary sm:text-xl">
          <Sunflower size={24} />
          Календарь дачника
        </span>
        <nav className="hidden items-center gap-1 sm:flex">
          {PRIMARY.map((n) => {
            const Icon = n.icon
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `dacha-chip flex items-center gap-1.5 ${isActive ? 'dacha-chip-active' : ''}`
                }
              >
                <Icon size={18} aria-hidden /> {n.label}
              </NavLink>
            )
          })}
          <MoreMenu />
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <Outlet />
      </main>

      <nav className="flex h-16 shrink-0 items-stretch justify-around border-t border-black/15 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.15)] sm:hidden">
        {PRIMARY.map((n) => {
          const Icon = n.icon
          return (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => bottomItem(isActive)}>
              <Icon size={20} aria-hidden />
              <span>{n.label}</span>
            </NavLink>
          )
        })}
        <MoreMenu dropUp />
      </nav>
    </div>
  )
}
