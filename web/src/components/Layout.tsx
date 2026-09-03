import { useEffect, useState } from 'react'
import { NavLink, useLocation, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import { Home, Sprout, CalendarDays, BookOpen, User, type LucideIcon } from 'lucide-react'
import Sunflower from '../ui/Sunflower'

type Item = { to: string; label: string; icon: LucideIcon }

// Зеркало Android bottom-nav (Navigation.kt bottomNavItems): тот же порядок и та же
// метафора иконок. «Ещё» больше нет — «Справочник» (общее) вместо него, личное/служебное
// уехало в «Профиль» (см. spec §3).
const PRIMARY: Item[] = [
  { to: '/today', label: 'Сегодня', icon: Home },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/plantings', label: 'Посадки', icon: Sprout },
  { to: '/reference', label: 'Справочник', icon: BookOpen },
  { to: '/profile', label: 'Профиль', icon: User },
]

// Иконка навигации с опциональным красным бейджем-счётчиком (зеркало Android BadgedBox
// на табе «Посадки»: число посадок, требующих ухода). Цвет = error/FrostRed (#D32F2F).
function NavIcon({ icon: Icon, size, badge }: { icon: LucideIcon; size: number; badge?: number }) {
  return (
    <span className="relative inline-flex">
      <Icon size={size} aria-hidden />
      {badge != null && badge > 0 && (
        <span
          className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D32F2F] px-1 text-[10px] font-black leading-none text-white"
          aria-label={`${badge} требуют ухода`}
        >
          {badge}
        </span>
      )}
    </span>
  )
}

const bottomItem = (isActive: boolean) =>
  `mx-0.5 my-1.5 flex flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl text-[11px] font-bold transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-muted'
  }`

export default function Layout() {
  const { gardenId } = useGardens()
  // Счётчик посадок, требующих ухода (overdue_care_task) — для бейджа на табе «Посадки».
  // Обновляется при смене участка и при переходах между разделами (после лога действия
  // просроченность спадает). Payload /plantings небольшой; отдельного стора не заводим.
  const [careCount, setCareCount] = useState(0)
  const { pathname } = useLocation()
  useEffect(() => {
    if (gardenId === -1) {
      setCareCount(0)
      return
    }
    let cancelled = false
    api
      .getPlantings(gardenId)
      .then((ps) => {
        if (!cancelled) setCareCount(ps.filter((p) => p.overdue_care_task).length)
      })
      .catch(() => {
        if (!cancelled) setCareCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [gardenId, pathname])

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
                <NavIcon icon={Icon} size={18} badge={n.to === '/plantings' ? careCount : undefined} />{' '}
                {n.label}
              </NavLink>
            )
          })}
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
              <NavIcon icon={Icon} size={20} badge={n.to === '/plantings' ? careCount : undefined} />
              <span>{n.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
