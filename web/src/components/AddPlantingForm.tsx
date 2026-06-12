import { useMemo, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { Crop } from '../api/types'

interface Props {
  gardenId: number
  crops: Crop[]
  onClose: () => void
  onCreated: () => void
}

export default function AddPlantingForm({ gardenId, crops, onClose, onCreated }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [cropId, setCropId] = useState<number | ''>('')
  const [plantedAt, setPlantedAt] = useState(today)
  const [quantity, setQuantity] = useState(1)
  const [conditions, setConditions] = useState<'soil' | 'greenhouse'>('soil')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedCrop = useMemo(
    () => crops.find((c) => c.id === cropId),
    [crops, cropId],
  )
  // Способ посадки по умолчанию: есть transplant_days → через рассаду (как в Android)
  const sowingMethod = selectedCrop?.transplant_days ? 'seedling' : 'direct'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (cropId === '') {
      setError('Выберите культуру')
      return
    }
    setBusy(true)
    try {
      await api.createPlanting({
        garden_id: gardenId,
        crop_id: cropId,
        planted_at: plantedAt,
        quantity,
        conditions,
        sowing_method: sowingMethod,
      })
      onCreated()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 402
            ? 'Нужна подписка или активный пробный период'
            : err.message
          : 'Не удалось добавить посадку'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="dacha-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-black">Новая посадка</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm font-bold text-muted">Культура</label>
          <select
            className="dacha-input"
            value={cropId}
            onChange={(e) => setCropId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— выберите —</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="mt-2 text-sm font-bold text-muted">Дата посадки</label>
          <input
            type="date"
            className="dacha-input"
            value={plantedAt}
            max={today}
            onChange={(e) => setPlantedAt(e.target.value)}
          />

          <label className="mt-2 text-sm font-bold text-muted">Количество</label>
          <input
            type="number"
            min={1}
            className="dacha-input"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />

          <label className="mt-2 text-sm font-bold text-muted">Условия</label>
          <div className="flex gap-2">
            {(['soil', 'greenhouse'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`dacha-chip ${conditions === c ? 'dacha-chip-active' : ''}`}
                onClick={() => setConditions(c)}
              >
                {c === 'soil' ? 'Грунт' : 'Теплица'}
              </button>
            ))}
          </div>

          {selectedCrop && (
            <p className="text-sm font-semibold text-muted">
              Способ: {sowingMethod === 'seedling' ? 'через рассаду' : 'прямой посев'}
            </p>
          )}

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button type="button" className="dacha-chip flex-1 py-3" onClick={onClose}>
              Отмена
            </button>
            <button className="dacha-btn flex-1" disabled={busy}>
              {busy ? '…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
