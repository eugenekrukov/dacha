import { useState } from 'react'
import { CalendarDays, Hammer, Leaf, Scissors, ShoppingBasket, Sprout, Trees, type LucideIcon } from 'lucide-react'
import type { SeasonWork, SeasonWorksResponse } from '../api/types'

// «На этой неделе · регион» (стратегия 2.3, зеркало Android SeasonWorksCard).
// «Сделано/Не актуально» — локально по ключу id:год (как скрытые советы), до следующего сезона.
const HIDDEN_KEY = 'dacha_hidden_season_works'
const COLLAPSED = 3

const ICONS: Record<SeasonWork['category'], LucideIcon> = {
  plan: CalendarDays,
  prep: Hammer,
  sow: Sprout,
  plant: Trees,
  care: Leaf,
  prune: Scissors,
  harvest: ShoppingBasket,
}

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export default function SeasonWorks({ works }: { works: SeasonWorksResponse }) {
  const [hidden, setHidden] = useState<Set<string>>(loadHidden)
  const [expanded, setExpanded] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)

  const items = works.items.filter((w) => !hidden.has(w.key))
  if (items.length === 0) return null

  const hide = (w: SeasonWork) => {
    const next = new Set(hidden).add(w.key)
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
    } catch {
      /* приватный режим — скрытие просто не переживёт перезагрузку */
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-black">
        На этой неделе{works.region ? ` · ${works.region}` : ''}
      </h2>
      <div className="dacha-card flex flex-col divide-y divide-black/5 px-4 py-1">
        {(expanded ? items : items.slice(0, COLLAPSED)).map((w) => {
          const Icon = ICONS[w.category] ?? Leaf
          const isOpen = opened === w.id
          return (
            <div key={w.id} className="py-3">
              <button
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpened(isOpen ? null : w.id)}
              >
                <Icon size={20} aria-hidden className="shrink-0 text-primary" />
                <span className="flex-1 font-bold">{w.title}</span>
                {w.in_garden && (
                  <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                    у вас есть
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="mt-2 flex flex-col gap-2 pl-8">
                  <p className="text-sm font-semibold text-muted">{w.details}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="dacha-chip px-3 py-1.5 text-sm" onClick={() => hide(w)}>Сделано</button>
                    <button className="dacha-chip px-3 py-1.5 text-sm text-muted" onClick={() => hide(w)}>
                      Не актуально
                    </button>
                    {w.link && (
                      <a className="text-link self-center text-sm font-bold" href={w.link} target="_blank" rel="noopener">
                        Справочник →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {items.length > COLLAPSED && (
          <button onClick={() => setExpanded((e) => !e)} className="text-link w-full py-2 text-sm font-bold">
            {expanded ? 'Свернуть' : `Показать ещё (${items.length - COLLAPSED})`}
          </button>
        )}
      </div>
    </section>
  )
}
