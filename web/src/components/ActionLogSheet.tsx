import { useState } from 'react'
import { X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { ACTION_CATALOG } from '../api/labels'
import { actionIcon } from '../ui/icons'
import type { CropRef } from '../api/types'

interface Props {
  plantingId?: number
  cropName?: string | null
  // Групповой режим: одно действие пишется во все перечисленные посадки.
  // Заголовок показывает список культур с крестиком удаления (минимум одна остаётся).
  plantings?: CropRef[]
  // Заголовок листа в групповом режиме (например, имя care-задачи «Прополка»).
  title?: string
  preselectedType?: string | null
  initialNote?: string
  onClose: () => void
  onLogged: (type: string) => void
}

export default function ActionLogSheet({
  plantingId,
  cropName,
  plantings,
  title,
  preselectedType,
  initialNote,
  onClose,
  onLogged,
}: Props) {
  const grouped = !!(plantings && plantings.length)
  const [targets, setTargets] = useState<CropRef[]>(
    grouped ? plantings! : [{ id: plantingId!, name: cropName ?? `Посадка #${plantingId}` }],
  )
  const [type, setType] = useState<string | null>(preselectedType ?? null)
  const [note, setNote] = useState(initialNote ?? '')
  // авто-заметка действует только для изначально предложенного типа; смена типа её убирает,
  // но введённый вручную текст не затираем (зеркало android ActionLogBottomSheet)
  const [autoNote, setAutoNote] = useState(initialNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = (t: string) => {
    setType(t)
    const auto = t === preselectedType ? (initialNote ?? '') : ''
    setNote((prev) => (prev === autoNote ? auto : prev))
    setAutoNote(auto)
  }

  const removeTarget = (id: number) => {
    setTargets((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev))
  }

  const save = async () => {
    if (!type || targets.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // Одно действие во все оставшиеся посадки (последовательно — чтобы первая ошибка
      // доступа/сети всплыла явно, а не потерялась среди параллельных запросов).
      for (const tg of targets) {
        if (type === 'transplanting') {
          // «Высадка»: фиксируем действие + переводим стадию в transplanted
          await api.logAction(tg.id, 'transplanting')
          await api.updateStage(tg.id, 'transplanted')
        } else {
          await api.logAction(tg.id, type, note.trim() || undefined)
        }
      }
      onLogged(type)
      onClose()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 402
            ? 'Нужна подписка или активный пробный период'
            : err.message
          : 'Не удалось записать действие'
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
        className="dacha-card max-h-[92vh] w-full max-w-md overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-black">
          {grouped ? (title ?? 'Действие') : (cropName ?? `Посадка #${plantingId}`)}
        </h2>

        {grouped && (
          <ul className="mb-3 mt-2 flex flex-col gap-1.5">
            {targets.map((tg) => (
              <li
                key={tg.id}
                className="flex items-center justify-between gap-2 rounded-btn bg-background px-3 py-2 font-bold"
              >
                <span className="min-w-0 truncate">{tg.name}</span>
                <button
                  type="button"
                  onClick={() => removeTarget(tg.id)}
                  disabled={targets.length === 1}
                  aria-label={`Убрать ${tg.name}`}
                  className="shrink-0 text-muted disabled:opacity-30"
                >
                  <X size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mb-3 font-bold text-muted">Что сделали?</p>

        <div className="grid grid-cols-2 gap-2">
          {ACTION_CATALOG.map((a) => {
            const Icon = actionIcon(a.type)
            const selected = type === a.type
            return (
              <button
                key={a.type}
                onClick={() => pick(a.type)}
                className={`flex items-center gap-2 rounded-btn border px-3 py-2.5 text-left font-bold transition active:scale-95 ${
                  selected ? 'border-primary bg-primary text-white' : 'border-black/10 bg-background'
                }`}
              >
                <Icon size={20} className="shrink-0" aria-hidden />
                {/* Полная подпись без обрезки: «Удаление усов/стрелок/цветков» теперь различимы */}
                <span className="leading-tight">{a.label}</span>
              </button>
            )
          })}
        </div>

        <input
          className="dacha-input mt-4"
          placeholder="Заметка (необязательно)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" className="dacha-chip flex-1 py-3" onClick={onClose}>
            Отмена
          </button>
          <button className="dacha-btn flex-1" disabled={!type || busy} onClick={save}>
            {busy ? '…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
