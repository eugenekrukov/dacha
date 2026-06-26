import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import Modal from './Modal'
import SubscribeCta from './SubscribeCta'
import { categoryLabel } from '../api/labels'
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
  const [variety, setVariety] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [conditions, setConditions] = useState<'soil' | 'greenhouse'>('soil')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [cropSearch, setCropSearch] = useState('')
  const [cropCategory, setCropCategory] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedCrop = useMemo(
    () => crops.find((c) => c.id === cropId),
    [crops, cropId],
  )

  const cropCategories = useMemo(
    () => Array.from(new Set(crops.map((c) => c.category).filter(Boolean))) as string[],
    [crops],
  )
  const cropQuery = cropSearch.trim().toLowerCase()
  const visibleCrops = cropQuery
    ? crops.filter((c) => c.name.toLowerCase().includes(cropQuery))
    : cropCategory
      ? crops.filter((c) => c.category === cropCategory)
      : crops

  const pickCrop = (c: Crop) => {
    setCropId(c.id)
    setCropSearch('')
    setCropOpen(false)
  }
  // Закрытие по клику вне комбобокса — onBlur с небольшой задержкой, чтобы успел сработать onClick по пункту списка.
  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setCropOpen(false), 120)
  }
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setCropOpen(true)
  }
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
        variety: variety.trim() || undefined,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить посадку')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      backdropClassName="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      className="max-h-[90dvh] w-full max-w-md overflow-y-auto p-6"
    >
        <h2 className="mb-4 text-xl font-black">Новая посадка</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm font-bold text-muted">Культура</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              className="dacha-input pl-10 pr-10"
              value={cropOpen ? cropSearch : selectedCrop?.name ?? cropSearch}
              onChange={(e) => {
                setCropSearch(e.target.value)
                if (cropId !== '') setCropId('')
              }}
              onFocus={handleFocus}
              onClick={handleFocus}
              onBlur={handleBlur}
              placeholder="Поиск культуры…"
              autoComplete="off"
            />
            {(cropOpen ? cropSearch : selectedCrop) && (
              <button
                type="button"
                aria-label="Очистить"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-btn p-1 text-muted hover:bg-background"
                onClick={() => {
                  setCropSearch('')
                  setCropId('')
                }}
              >
                <X size={18} aria-hidden />
              </button>
            )}

            {cropOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-card border border-black/10 bg-white p-2 shadow-lg">
                {!cropQuery && cropCategories.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={`dacha-chip ${cropCategory === null ? 'dacha-chip-active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setCropCategory(null)}
                    >
                      Все
                    </button>
                    {cropCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`dacha-chip ${cropCategory === cat ? 'dacha-chip-active' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCropCategory(cat)}
                      >
                        {categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto">
                  {visibleCrops.length === 0 ? (
                    <p className="py-2 text-center text-sm font-semibold text-muted">Ничего не найдено</p>
                  ) : (
                    visibleCrops.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCrop(c)}
                        className={`block w-full rounded-btn px-3 py-2 text-left text-sm font-semibold hover:bg-background ${
                          c.id === cropId ? 'bg-primary/10 text-primary' : ''
                        }`}
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="mt-2 text-sm font-bold text-muted">Сорт (необязательно)</label>
          <input
            type="text"
            className="dacha-input"
            placeholder="Например: Бычье сердце"
            maxLength={120}
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
          />

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

          {error && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-red-600">{error}</p>
              <SubscribeCta message={error} />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button type="button" className="dacha-chip flex-1 py-3" onClick={onClose}>
              Отмена
            </button>
            <button className="dacha-btn flex-1" disabled={busy}>
              {busy ? '…' : 'Добавить'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
