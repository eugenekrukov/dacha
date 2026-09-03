import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { guideKindIcon } from '../ui/icons'
import { GUIDE_KIND_LABELS } from '../api/labels'
import type { GuideEntry, GuideKind } from '../api/types'
import ErrorCard from '../components/ErrorCard'
import GuideList from '../components/GuideList'

const KINDS: GuideKind[] = ['deficiency', 'disease', 'pest']

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
      {error && <ErrorCard message={error} />}

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

      <GuideList entries={visible} emptyText="Ничего не найдено." />
    </div>
  )
}
