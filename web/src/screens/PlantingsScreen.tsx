import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import { STAGE_LABELS, formatDate } from '../api/labels'
import type { Crop, Planting } from '../api/types'
import AddPlantingForm from '../components/AddPlantingForm'

export default function PlantingsScreen() {
  const { gardenId } = useGardens()
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    if (gardenId === -1) return
    setError(null)
    try {
      const [p, c] = await Promise.all([api.getPlantings(gardenId), api.getCrops()])
      setPlantings(p)
      setCrops(c)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardenId])

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  const active = plantings.filter((p) => p.stage !== 'done')
  const archived = plantings.filter((p) => p.stage === 'done')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Посадки</h1>
        <button className="dacha-btn h-10 px-4" onClick={() => setAdding(true)}>
          + Добавить
        </button>
      </div>

      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      {active.length === 0 && !error && (
        <div className="dacha-card p-6 text-center font-semibold text-muted">
          Пока нет активных посадок. Добавьте первую 🌱
        </div>
      )}

      {active.map((p) => (
        <PlantingCard key={p.id} p={p} />
      ))}

      {archived.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-black text-muted">Завершённые</h2>
          {archived.map((p) => (
            <PlantingCard key={p.id} p={p} />
          ))}
        </>
      )}

      {adding && (
        <AddPlantingForm
          gardenId={gardenId}
          crops={crops}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function PlantingCard({ p }: { p: Planting }) {
  return (
    <Link to={`/plantings/${p.id}`} className="dacha-card flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-black">{p.crop_name ?? `Посадка #${p.id}`}</span>
        <span className="dacha-chip bg-background text-xs text-tertiary">
          {STAGE_LABELS[p.stage] ?? p.stage}
        </span>
      </div>
      <span className="text-sm font-semibold text-muted">
        Посажено {formatDate(p.planted_at)} · {p.quantity ?? 1} шт.
        {p.conditions === 'greenhouse' ? ' · теплица' : ''}
      </span>
      {p.overdue_care_task && (
        <span className="text-sm font-bold text-red-600">
          ⚠ {p.overdue_care_task.name}
          {p.overdue_care_task.days_overdue > 0 ? ` (просрочено ${p.overdue_care_task.days_overdue} дн.)` : ''}
        </span>
      )}
    </Link>
  )
}
