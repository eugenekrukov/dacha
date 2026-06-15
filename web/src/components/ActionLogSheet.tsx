import { useState } from 'react'
import { api, ApiError } from '../api/client'
import { ACTION_CATALOG } from '../api/labels'
import { actionIcon } from '../ui/icons'

interface Props {
  plantingId: number
  cropName?: string | null
  preselectedType?: string | null
  initialNote?: string
  onClose: () => void
  onLogged: (type: string) => void
}

export default function ActionLogSheet({
  plantingId,
  cropName,
  preselectedType,
  initialNote,
  onClose,
  onLogged,
}: Props) {
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

  const save = async () => {
    if (!type) return
    setBusy(true)
    setError(null)
    try {
      if (type === 'transplanting') {
        // «Высадка»: фиксируем действие + переводим стадию в transplanted
        await api.logAction(plantingId, 'transplanting')
        await api.updateStage(plantingId, 'transplanted')
      } else {
        await api.logAction(plantingId, type, note.trim() || undefined)
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
        <h2 className="text-xl font-black">{cropName ?? `Посадка #${plantingId}`}</h2>
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
