import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { api, ApiError } from '../api/client'
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

export default function GuideScreen() {
  const [params] = useSearchParams()
  const cropId = params.get('crop_id')
  const cropName = params.get('crop')
  const [entries, setEntries] = useState<GuideEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<GuideKind | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .getGuide(cropId ? { crop_id: Number(cropId) } : undefined)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочник'))
      .finally(() => setLoading(false))
  }, [cropId])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (kind && e.kind !== kind) return false
      if (needle && !(`${e.name} ${e.symptoms ?? ''}`.toLowerCase().includes(needle))) return false
      return true
    })
  }, [entries, kind, q])

  const groups = useMemo(
    () => KINDS.map((k) => ({ kind: k, items: visible.filter((e) => e.kind === k) })).filter((g) => g.items.length),
    [visible],
  )

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Справочник проблем</h1>
      {cropId && (
        <Link
          to="/guide"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
        >
          <span>Культура: {cropName || `#${cropId}`}</span>
          <X size={16} aria-hidden />
        </Link>
      )}
      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск: калий, фитофтороз, паутинка…"
        className="w-full rounded-btn border border-black/10 bg-white px-4 py-2.5 font-semibold outline-none focus:border-primary"
      />

      <div className="flex flex-wrap gap-2">
        <button
          className={`dacha-chip ${kind === null ? 'dacha-chip-active' : ''}`}
          onClick={() => setKind(null)}
        >
          Все
        </button>
        {KINDS.map((k) => {
          const Icon = guideKindIcon(k)
          return (
            <button
              key={k}
              className={`dacha-chip inline-flex items-center gap-1.5 ${kind === k ? 'dacha-chip-active' : ''}`}
              onClick={() => setKind(k)}
            >
              <Icon size={15} aria-hidden /> {GUIDE_KIND_LABELS[k]}
            </button>
          )
        })}
      </div>

      {groups.length === 0 ? (
        <p className="dacha-card p-4 font-semibold text-muted">Ничего не найдено.</p>
      ) : (
        groups.map((g) => {
          const Icon = guideKindIcon(g.kind)
          return (
          <div key={g.kind} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Icon size={20} aria-hidden /> {GUIDE_KIND_LABELS[g.kind]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.items.map((e) => (
                <Link
                  key={e.id}
                  to={`/guide/${e.slug}`}
                  className="dacha-card-link flex flex-col gap-1 p-4"
                >
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
        })
      )}
    </div>
  )
}
