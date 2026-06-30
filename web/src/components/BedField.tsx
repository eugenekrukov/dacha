import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { GardenBed } from '../api/types'

interface Props {
  gardenId: number
  value: number | null
  cropFamily?: string | null
  onSelect: (bed: GardenBed | null) => void
}

// Грядка — просто именованное место (см. design 2026-06-27), без визуальной карты участка.
// Пикер открывается инлайн в той же форме/секции — отдельного экрана управления грядками нет.
export default function BedField({ gardenId, value, cropFamily, onSelect }: Props) {
  const [beds, setBeds] = useState<GardenBed[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'soil' | 'greenhouse'>('soil')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = async () => {
    try {
      const list = await api.getBeds(gardenId)
      setBeds(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить грядки')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardenId])

  const selectedBed = beds.find((b) => b.id === value) ?? null

  const pick = (bed: GardenBed | null) => {
    onSelect(bed)
    setOpen(false)
  }

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const bed = await api.createBed(gardenId, { name, type: newType })
      setBeds((prev) => [...prev, bed])
      setNewName('')
      setNewType('soil')
      setCreating(false)
      pick(bed)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать грядку')
    }
  }

  const startRename = (bed: GardenBed) => {
    setRenamingId(bed.id)
    setRenameValue(bed.name)
  }

  const submitRename = async (bed: GardenBed) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === bed.name) return
    try {
      const updated = await api.updateBed(bed.id, { name })
      setBeds((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)))
      if (value === bed.id) onSelect({ ...bed, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось переименовать грядку')
    }
  }

  const removeBed = async (bed: GardenBed) => {
    if (!confirm(`Удалить грядку «${bed.name}»?`)) return
    try {
      await api.deleteBed(bed.id)
      setBeds((prev) => prev.filter((b) => b.id !== bed.id))
      if (value === bed.id) pick(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить грядку')
    }
  }

  const warning = rotationWarning(selectedBed, cropFamily)

  return (
    <div className="relative">
      <button
        type="button"
        className="dacha-input flex items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selectedBed ? '' : 'text-muted'}>
          {selectedBed ? selectedBed.name : 'Не выбрано'}
        </span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-card border border-black/10 bg-white p-2 shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(null)}
            className={`block w-full rounded-btn px-3 py-2 text-left text-sm font-semibold hover:bg-background ${
              value === null ? 'bg-primary/10 text-primary' : ''
            }`}
          >
            Не выбрано
          </button>

          <div className="max-h-48 overflow-y-auto">
            {beds.map((bed) => (
              <div key={bed.id} className="flex items-center gap-1">
                {renamingId === bed.id ? (
                  <input
                    autoFocus
                    className="dacha-input flex-1 py-1.5 text-sm"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(bed)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(bed)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(bed)}
                    className={`block flex-1 rounded-btn px-3 py-2 text-left text-sm font-semibold hover:bg-background ${
                      bed.id === value ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    {bed.name}{' '}
                    <span className="text-xs text-muted">
                      {bed.type === 'greenhouse' ? '· теплица' : '· грунт'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Переименовать"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => startRename(bed)}
                  className="rounded-btn p-1.5 text-muted hover:bg-background"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Удалить"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => removeBed(bed)}
                  className="rounded-btn p-1.5 text-muted hover:bg-background"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>

          {creating ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-black/10 pt-2">
              <input
                autoFocus
                className="dacha-input py-1.5 text-sm"
                placeholder="Название грядки"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex gap-1.5">
                {(['soil', 'greenhouse'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className={`dacha-chip ${newType === t ? 'dacha-chip-active' : ''}`}
                    onClick={() => setNewType(t)}
                  >
                    {t === 'soil' ? 'Грунт' : 'Теплица'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="dacha-chip flex-1 py-1.5 text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCreating(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="dacha-btn flex-1 py-1.5 text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={submitCreate}
                >
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-1.5 rounded-btn px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-background"
            >
              <Plus size={14} aria-hidden /> Новая грядка
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      {warning && <p className="mt-1 text-xs font-semibold text-amber-700">{warning}</p>}
    </div>
  )
}

// Сравнение по семейству за 3 года истории грядки (история уже приходит с грядкой одним запросом).
function rotationWarning(bed: GardenBed | null, cropFamily?: string | null): string | null {
  if (!bed || !cropFamily) return null
  const match = [...bed.history]
    .filter((h) => h.family === cropFamily)
    .sort((a, b) => b.year - a.year)[0]
  if (!match) return null
  return `На грядке «${bed.name}» в ${match.year} росла культура семейства «${cropFamily}» (${match.crop_name}) — для этого семейства рекомендуют перерыв 3–4 года.`
}
