import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { GUIDE_KIND_LABELS } from '../api/labels'
import { guideKindIcon } from '../ui/icons'
import type { GuideEntryDetail } from '../api/types'

function Block({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-tertiary' : ''}`}>{value}</p>
    </div>
  )
}

export default function GuideDetailScreen() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<GuideEntryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    api
      .getGuideEntry(slug)
      .then(setEntry)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить запись'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!entry) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  const crops = entry.crops ?? []

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-left font-bold text-muted">
        <ArrowLeft size={18} aria-hidden /> Назад
      </button>

      <div className="dacha-card flex flex-col gap-2 p-5">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          {(() => {
            const Icon = guideKindIcon(entry.kind)
            return <Icon size={24} aria-hidden />
          })()}
          {entry.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-muted">{GUIDE_KIND_LABELS[entry.kind]}</span>
          {entry.element && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              {entry.element}
            </span>
          )}
          {entry.season && (
            <span className="rounded-full bg-tertiary/15 px-2.5 py-0.5 text-xs font-bold text-tertiary">
              {entry.season}
            </span>
          )}
        </div>
      </div>

      {entry.image_url && (
        <img
          src={entry.image_url}
          alt={entry.name}
          className="w-full rounded-card object-cover"
          loading="lazy"
        />
      )}

      <section className="dacha-card flex flex-col gap-3 p-5">
        <Block label="Описание" value={entry.description} />
        <Block label="Симптомы" value={entry.symptoms} />
        <Block label={entry.kind === 'deficiency' ? 'Причина' : 'Условия'} value={entry.conditions} />
        <Block label={entry.kind === 'deficiency' ? 'Коррекция' : 'Лечение'} value={entry.treatment} highlight />
        <Block label="Профилактика" value={entry.prevention} />
        {entry.image_credit && (
          <p className="text-[11px] font-semibold text-muted">Фото: {entry.image_credit}</p>
        )}
      </section>

      {crops.length > 0 && (
        <section className="dacha-card p-5">
          <h2 className="mb-3 text-lg font-black">Где встречается</h2>
          <div className="flex flex-col gap-2">
            {crops.map((c) => (
              <Link
                key={c.crop_id}
                to={`/crops/${c.crop_id}`}
                className="rounded-card border border-black/10 bg-white p-3 transition hover:bg-background"
              >
                <p className="font-black">{c.crop_name}</p>
                {c.signs && <p className="text-sm font-semibold text-muted">{c.signs}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
