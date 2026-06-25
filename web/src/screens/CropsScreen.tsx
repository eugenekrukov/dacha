import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { categoryLabel } from '../api/labels'
import type { Crop } from '../api/types'
import ErrorCard from '../components/ErrorCard'

export default function CropsScreen() {
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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
  const q = query.trim().toLowerCase()
  // Поиск (по имени) имеет приоритет над фильтром категории — как в Android.
  const visible = q
    ? crops.filter((c) => c.name.toLowerCase().includes(q))
    : category
      ? crops.filter((c) => c.category === category)
      : crops
  const annuals = visible.filter((c) => !c.is_perennial)
  const perennials = visible.filter((c) => c.is_perennial)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Справочник культур</h1>

      {/* Поле поиска */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск культуры…"
          className="dacha-card w-full rounded-2xl py-3 pl-11 pr-10 font-semibold outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button
            aria-label="Очистить"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && <ErrorCard message={error} />}

      {/* Категории прячем во время поиска (как в Android) */}
      {!q && categories.length > 0 && (
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

      {loading ? (
        <p className="p-4 font-bold text-muted">Загрузка…</p>
      ) : visible.length === 0 ? (
        <div className="dacha-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-3xl">🌿</span>
          <p className="font-semibold text-muted">
            {q ? `Ничего не найдено по «${query.trim()}»` : 'Культуры не найдены'}
          </p>
        </div>
      ) : annuals.length > 0 && perennials.length > 0 ? (
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
            {c.image_url && (
              <img
                src={c.image_url}
                alt={c.name}
                loading="lazy"
                className="mb-1 aspect-[4/3] w-full rounded-btn object-cover"
              />
            )}
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
