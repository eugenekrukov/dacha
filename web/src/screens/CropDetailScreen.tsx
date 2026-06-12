import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { categoryLabel } from '../api/labels'
import type { Crop } from '../api/types'

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-3 border-b border-black/5 py-2 last:border-0">
      <span className="font-semibold text-muted">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  )
}

export default function CropDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [crop, setCrop] = useState<Crop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getCrop(Number(id))
      .then(setCrop)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить культуру'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!crop) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="text-left font-bold text-muted">
        ← Назад
      </button>

      <div className="dacha-card flex flex-col gap-1 p-5">
        <h1 className="text-2xl font-black">{crop.name}</h1>
        {crop.category && <span className="font-semibold text-muted">{categoryLabel(crop.category)}</span>}
      </div>

      <section className="dacha-card p-5">
        <h2 className="mb-2 text-lg font-black">Сроки и уход</h2>
        <Fact label="Высадка рассады" value={crop.transplant_days ? `через ${crop.transplant_days} дн.` : null} />
        <Fact label="До урожая" value={crop.harvest_days ? `${crop.harvest_days} дн.` : null} />
        <Fact label="Полив" value={crop.watering_freq_days ? `каждые ${crop.watering_freq_days} дн.` : null} />
        <Fact label="Чувствительна к заморозкам" value={crop.frost_sensitive ? 'да' : null} />
        <Fact
          label="Урожай с растения"
          value={crop.yield_per_plant_kg ? `~${crop.yield_per_plant_kg} кг` : null}
        />
      </section>

      {(crop.good_neighbors?.length || crop.bad_neighbors?.length) && (
        <section className="dacha-card p-5">
          <h2 className="mb-2 text-lg font-black">Соседство</h2>
          {crop.good_neighbors?.length ? (
            <p className="mb-1 font-semibold">
              <span className="text-tertiary">✓ Хорошие соседи:</span> {crop.good_neighbors.join(', ')}
            </p>
          ) : null}
          {crop.bad_neighbors?.length ? (
            <p className="font-semibold">
              <span className="text-red-600">✗ Плохие соседи:</span> {crop.bad_neighbors.join(', ')}
            </p>
          ) : null}
        </section>
      )}

      {crop.notes && (
        <section className="dacha-card p-5">
          <h2 className="mb-2 text-lg font-black">Заметки</h2>
          <p className="font-semibold text-muted">{crop.notes}</p>
        </section>
      )}
    </div>
  )
}
