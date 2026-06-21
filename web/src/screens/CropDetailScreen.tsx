import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Leaf } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { categoryLabel } from '../api/labels'
import ProblemList from '../components/ProblemList'
import { CareSection, NeighborsSection } from '../components/CropCare'
import type { Crop, GuideEntry } from '../api/types'

type Tab = 'care' | 'disease' | 'pest' | 'neighbors'
const TABS: { key: Tab; label: string }[] = [
  { key: 'care', label: 'Уход' },
  { key: 'disease', label: 'Болезни' },
  { key: 'pest', label: 'Вредители' },
  { key: 'neighbors', label: 'Соседи' },
]

export default function CropDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [crop, setCrop] = useState<Crop | null>(null)
  const [problems, setProblems] = useState<GuideEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('care')

  useEffect(() => {
    const cropId = Number(id)
    api
      .getCrop(cropId)
      .then(setCrop)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить культуру'))
      .finally(() => setLoading(false))
    api.getGuide({ crop_id: cropId }).then(setProblems).catch(() => setProblems([]))
  }, [id])

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!crop) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-left font-bold text-muted">
        <ArrowLeft size={18} aria-hidden /> Назад
      </button>

      {crop.image_url && (
        <figure className="overflow-hidden rounded-2xl">
          <img src={crop.image_url} alt={crop.name} loading="lazy" className="aspect-[16/9] w-full object-cover" />
          {crop.image_credit && (
            <figcaption className="px-1 pt-1 text-[11px] text-muted">{crop.image_credit}</figcaption>
          )}
        </figure>
      )}

      <div className="dacha-card flex flex-col gap-2 p-5">
        <h1 className="text-2xl font-black">{crop.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {crop.category && <span className="font-semibold text-muted">{categoryLabel(crop.category)}</span>}
          {crop.is_perennial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/15 px-2.5 py-0.5 text-xs font-bold text-tertiary">
              <Leaf size={13} aria-hidden /> Многолетник
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`dacha-chip ${tab === t.key ? 'dacha-chip-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'care' && <CareSection crop={crop} />}
      {tab === 'disease' && (
        <ProblemList entries={problems} kind="disease" cropId={crop.id} cropName={crop.name} emptyText="Болезни не отмечены." />
      )}
      {tab === 'pest' && (
        <ProblemList entries={problems} kind="pest" cropId={crop.id} cropName={crop.name} emptyText="Вредители не отмечены." />
      )}
      {tab === 'neighbors' && <NeighborsSection crop={crop} />}
    </div>
  )
}
