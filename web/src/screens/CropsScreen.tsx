import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { categoryLabel } from '../api/labels'
import type { Crop } from '../api/types'

export default function CropsScreen() {
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    api
      .getCrops()
      .then(setCrops)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить культуры'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(crops.map((c) => c.category).filter(Boolean))) as string[],
    [crops],
  )
  const visible = category ? crops.filter((c) => c.category === category) : crops
  const annuals = visible.filter((c) => !c.is_perennial)
  const perennials = visible.filter((c) => c.is_perennial)

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Справочник культур</h1>
      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`dacha-chip ${category === null ? 'dacha-chip-active' : ''}`}
            onClick={() => setCategory(null)}
          >
            Все
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`dacha-chip ${category === c ? 'dacha-chip-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {annuals.length > 0 && perennials.length > 0 ? (
        <>
          <CropGroup title="Однолетние" crops={annuals} />
          <CropGroup title="Многолетние" subtitle="не нужно сажать каждый год" crops={perennials} />
        </>
      ) : (
        <CropGroup crops={visible} />
      )}
    </div>
  )
}

function CropGroup({ title, subtitle, crops }: { title?: string; subtitle?: string; crops: Crop[] }) {
  return (
    <div className="flex flex-col gap-2">
      {title && (
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-black">{title}</h2>
          {subtitle && <span className="text-xs font-semibold text-muted">{subtitle}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {crops.map((c) => (
          <Link key={c.id} to={`/crops/${c.id}`} className="dacha-card-link flex flex-col gap-1 p-4">
            <span className="font-black">{c.name}</span>
            <div className="flex flex-wrap items-center gap-1">
              {c.category && (
                <span className="text-xs font-semibold text-muted">{categoryLabel(c.category)}</span>
              )}
              {c.is_perennial && (
                <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                  многолетник
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
