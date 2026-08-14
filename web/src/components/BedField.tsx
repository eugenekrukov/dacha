import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { GardenBed } from '../api/types'

interface Props {
  gardenId: number
  value: number | null
  cropFamily?: string | null
  /** Схема посадки культуры — для подсказки вместимости грядки (см. capacityHint). */
  cropSpacingInRowCm?: number | null
  cropSpacingBetweenRowsCm?: number | null
  /** id редактируемой посадки — исключается из истории грядки (см. rotationWarning). */
  excludePlantingId?: number | null
  onSelect: (bed: GardenBed | null) => void
}

// Грядка — просто именованное место (см. design 2026-06-27), без визуальной карты участка.
// Пикер открывается инлайн в той же форме/секции — отдельного экрана управления грядками нет.
export default function BedField({
  gardenId, value, cropFamily, cropSpacingInRowCm, cropSpacingBetweenRowsCm, excludePlantingId, onSelect,
}: Props) {
  const [beds, setBeds] = useState<GardenBed[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'soil' | 'greenhouse'>('soil')
  const [newWidth, setNewWidth] = useState('')
  const [newLength, setNewLength] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameWidth, setRenameWidth] = useState('')
  const [renameLength, setRenameLength] = useState('')

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
      const bed = await api.createBed(gardenId, {
        name,
        type: newType,
        width_cm: newWidth ? Number(newWidth) : null,
        length_cm: newLength ? Number(newLength) : null,
      })
      setBeds((prev) => [...prev, bed])
      setNewName('')
      setNewType('soil')
      setNewWidth('')
      setNewLength('')
      setCreating(false)
      pick(bed)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать грядку')
    }
  }

  const startRename = (bed: GardenBed) => {
    setRenamingId(bed.id)
    setRenameValue(bed.name)
    setRenameWidth(bed.width_cm ? String(bed.width_cm) : '')
    setRenameLength(bed.length_cm ? String(bed.length_cm) : '')
  }

  const submitRename = async (bed: GardenBed) => {
    const name = renameValue.trim()
    const width = renameWidth ? Number(renameWidth) : null
    const length = renameLength ? Number(renameLength) : null
    setRenamingId(null)
    const nameChanged = name && name !== bed.name
    const sizeChanged = width !== (bed.width_cm ?? null) || length !== (bed.length_cm ?? null)
    if (!nameChanged && !sizeChanged) return
    try {
      const updated = await api.updateBed(bed.id, {
        ...(nameChanged ? { name } : {}),
        width_cm: width,
        length_cm: length,
      })
      setBeds((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      if (value === bed.id) onSelect(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить грядку')
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

  const warning = rotationWarning(selectedBed, cropFamily, excludePlantingId)
  const capacity = capacityHint(selectedBed, cropSpacingInRowCm, cropSpacingBetweenRowsCm)

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
            {beds.map((bed) =>
              renamingId === bed.id ? (
                <div key={bed.id} className="flex flex-col gap-1 px-1 py-1">
                  <input
                    autoFocus
                    className="dacha-input py-1.5 text-sm"
                    placeholder="Название грядки"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(bed)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  {schemeLine(cropSpacingInRowCm, cropSpacingBetweenRowsCm) && (
                    <p className="text-xs font-semibold text-muted">
                      {schemeLine(cropSpacingInRowCm, cropSpacingBetweenRowsCm)}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input
                      className="dacha-input w-20 py-1.5 text-sm"
                      type="number"
                      min={1}
                      placeholder="Ширина, см"
                      value={renameWidth}
                      onChange={(e) => setRenameWidth(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitRename(bed)}
                    />
                    <span className="text-xs text-muted">×</span>
                    <input
                      className="dacha-input w-20 py-1.5 text-sm"
                      type="number"
                      min={1}
                      placeholder="Длина, см"
                      value={renameLength}
                      onChange={(e) => setRenameLength(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submitRename(bed)}
                    />
                    <button
                      type="button"
                      className="dacha-btn ml-auto px-3 py-1.5 text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => submitRename(bed)}
                    >
                      Сохранить
                    </button>
                  </div>
                  {sizePreview(renameWidth, renameLength, cropSpacingInRowCm, cropSpacingBetweenRowsCm) && (
                    <p className="text-xs font-semibold text-muted">
                      {sizePreview(renameWidth, renameLength, cropSpacingInRowCm, cropSpacingBetweenRowsCm)}
                    </p>
                  )}
                </div>
              ) : (
                <div key={bed.id} className="flex items-center gap-1">
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
                      {bed.width_cm && bed.length_cm ? ` · ${bed.width_cm}×${bed.length_cm} см` : ''}
                    </span>
                  </button>
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
              )
            )}
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
              {schemeLine(cropSpacingInRowCm, cropSpacingBetweenRowsCm) && (
                <p className="text-xs font-semibold text-muted">
                  {schemeLine(cropSpacingInRowCm, cropSpacingBetweenRowsCm)}
                </p>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  className="dacha-input w-20 py-1.5 text-sm"
                  type="number"
                  min={1}
                  placeholder="Ширина, см"
                  value={newWidth}
                  onChange={(e) => setNewWidth(e.target.value)}
                />
                <span className="text-xs text-muted">×</span>
                <input
                  className="dacha-input w-20 py-1.5 text-sm"
                  type="number"
                  min={1}
                  placeholder="Длина, см"
                  value={newLength}
                  onChange={(e) => setNewLength(e.target.value)}
                />
                <span className="text-xs text-muted">(необязательно)</span>
              </div>
              {sizePreview(newWidth, newLength, cropSpacingInRowCm, cropSpacingBetweenRowsCm) && (
                <p className="text-xs font-semibold text-muted">
                  {sizePreview(newWidth, newLength, cropSpacingInRowCm, cropSpacingBetweenRowsCm)}
                </p>
              )}
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
      {capacity != null && <p className="mt-1 text-xs font-semibold text-muted">{capacity}</p>}
    </div>
  )
}

// Прикидка вместимости грядки: прямоугольная сетка по схеме посадки культуры (в ряду × между
// рядами) и размеру грядки. Оценочная — реальная посадка не всегда идеальной сеткой (загущение
// по краям, форма грядки), но ориентир «сколько примерно влезет» для планирования достаточен.
// Общее ядро расчёта — используется и для подсказки у выбранной грядки (capacityHint), и для
// живого предпросмотра прямо в форме создания/правки размера (см. SizePreview), пока пользователь
// печатает — иначе смысл вводить размер вообще не виден, пока не пересоздашь грядку и не откроешь её снова.
function capacityText(
  widthCm: number, lengthCm: number, spacingInRowCm: number, spacingBetweenRowsCm: number,
): string {
  const rows = Math.floor(widthCm / spacingBetweenRowsCm)
  const perRow = Math.floor(lengthCm / spacingInRowCm)
  const capacity = rows * perRow
  if (capacity <= 0) {
    return `${widthCm}×${lengthCm} см меньше рекомендованной схемы посадки для этой культуры — ` +
      `нужно хотя бы ${spacingBetweenRowsCm}×${spacingInRowCm} см (между рядами × в ряду) на одно растение.`
  }
  return `${widthCm}×${lengthCm} см — поместится примерно ${capacity} раст. ` +
    `(схема посадки: ${spacingBetweenRowsCm}×${spacingInRowCm} см)`
}

function capacityHint(
  bed: GardenBed | null,
  spacingInRowCm?: number | null,
  spacingBetweenRowsCm?: number | null,
): string | null {
  if (!bed || !bed.width_cm || !bed.length_cm || !spacingInRowCm || !spacingBetweenRowsCm) return null
  return `На грядке «${bed.name}»: ${capacityText(bed.width_cm, bed.length_cm, spacingInRowCm, spacingBetweenRowsCm)}`
}

// Схема посадки видна сразу при открытии полей размера, ещё до ввода — иначе непонятно, зачем
// вообще указывать размер грядки (жалоба владельца 2026-08-14: «ни схемы, ни какой должна быть
// грядка я информацию не получаю»).
function schemeLine(spacingInRowCm?: number | null, spacingBetweenRowsCm?: number | null): string | null {
  if (!spacingInRowCm || !spacingBetweenRowsCm) return null
  return `Схема посадки культуры: ${spacingBetweenRowsCm}×${spacingInRowCm} см (между рядами × в ряду)`
}

// Живой предпросмотр вместимости прямо под полями ширины/длины в форме — считается из введённого
// текста, ещё до сохранения. null, если размер не введён или для культуры нет схемы посадки.
function sizePreview(
  widthText: string, lengthText: string,
  spacingInRowCm?: number | null, spacingBetweenRowsCm?: number | null,
): string | null {
  const w = Number(widthText)
  const l = Number(lengthText)
  if (!w || !l || !spacingInRowCm || !spacingBetweenRowsCm) return null
  return capacityText(w, l, spacingInRowCm, spacingBetweenRowsCm)
}

// Сравнение по семейству за 3 года истории грядки (история уже приходит с грядкой одним запросом).
// excludePlantingId — посадка, для которой считаем подсказку: она сама входит в историю своей грядки
// и без исключения предупреждала бы о конфликте с самой собой. При создании новой посадки — undefined.
function rotationWarning(
  bed: GardenBed | null,
  cropFamily?: string | null,
  excludePlantingId?: number | null,
): string | null {
  if (!bed || !cropFamily) return null
  const match = [...bed.history]
    .filter((h) => h.family === cropFamily && (excludePlantingId == null || h.planting_id !== excludePlantingId))
    .sort((a, b) => b.year - a.year)[0]
  if (!match) return null
  return `На грядке «${bed.name}» в ${match.year} росла культура семейства «${cropFamily}» (${match.crop_name}) — для этого семейства рекомендуют перерыв 3–4 года.`
}
