import { Link } from 'react-router-dom'
import { GUIDE_KIND_LABELS } from '../api/labels'
import { guideKindIcon } from '../ui/icons'
import type { GuideEntry, GuideKind } from '../api/types'

const KINDS: GuideKind[] = ['deficiency', 'disease', 'pest']

// Бейдж опасности: 3 — высокая (красный), 2 — средняя (янтарный), 1/нет — не показываем.
function DangerBadge({ danger }: { danger?: number | null }) {
  if (!danger || danger < 2) return null
  const high = danger >= 3
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        high ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {high ? 'опасно' : 'осторожно'}
    </span>
  )
}

// Список записей справочника, сгруппированный по kind — вынесено из GuideScreen.tsx,
// чтобы переиспользовать в ReferenceScreen (см. spec §5 web).
export default function GuideList({ entries, emptyText }: { entries: GuideEntry[]; emptyText?: string }) {
  const groups = KINDS.map((k) => ({ kind: k, items: entries.filter((e) => e.kind === k) })).filter(
    (g) => g.items.length,
  )

  if (groups.length === 0) {
    return emptyText ? <p className="dacha-card p-4 font-semibold text-muted">{emptyText}</p> : null
  }

  return (
    <>
      {groups.map((g) => {
        const Icon = guideKindIcon(g.kind)
        return (
          <div key={g.kind} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Icon size={20} aria-hidden /> {GUIDE_KIND_LABELS[g.kind]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.items.map((e) => (
                <Link key={e.id} to={`/guide/${e.slug}`} className="dacha-card-link flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black">{e.name}</span>
                    <DangerBadge danger={e.danger} />
                  </div>
                  {e.symptoms && (
                    <span className="line-clamp-2 text-sm font-semibold text-muted">{e.symptoms}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
