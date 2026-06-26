import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { ACTION_CATALOG } from '../api/labels'
import { actionIcon } from '../ui/icons'
import SubscribeCta from './SubscribeCta'
import type { ActionLog, CropRef } from '../api/types'

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
  // Фото-вложение — только в одиночном режиме (один кадр на одну посадку/действие).
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  // Действие записано, но фото не загрузилось — кнопка превращается в «Закрыть».
  const [savedWithoutPhoto, setSavedWithoutPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      let lastLogged: ActionLog | null = null
      for (const tg of targets) {
        if (type === 'transplanting') {
          // «Высадка»: фиксируем действие + переводим стадию в transplanted
          lastLogged = await api.logAction(tg.id, 'transplanting')
          await api.updateStage(tg.id, 'transplanted')
        } else {
          lastLogged = await api.logAction(tg.id, type, note.trim() || undefined)
        }
      }
      // Фото привязываем к записанному действию (только когда остался один target —
      // в т.ч. групповой режим, если пользователь убрал все культуры кроме одной).
      if (targets.length === 1 && photoFile && lastLogged) {
        try {
          await api.uploadPhoto(targets[0].id, photoFile, { actionId: lastLogged.id })
        } catch {
          // Действие важнее фото — не откатываем; сообщаем и даём закрыть.
          setError('Действие записано, но фото не загрузилось')
          setSavedWithoutPhoto(true)
          setBusy(false)
          return
        }
      }
      onLogged(type)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось записать действие')
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
        className="dacha-card max-h-[92dvh] w-full max-w-md overflow-y-auto p-6"
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

        {targets.length === 1 && (
          <div className="mt-3">
            {photoFile ? (
              <div className="flex items-center justify-between rounded-btn bg-background px-3 py-2 text-sm font-bold">
                <span className="min-w-0 truncate">📷 {photoFile.name}</span>
                <button type="button" onClick={() => setPhotoFile(null)} aria-label="Убрать фото" className="shrink-0 text-muted">
                  <X size={18} aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="dacha-chip flex items-center gap-1.5 px-3 py-2"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={18} aria-hidden /> Прикрепить фото
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                setPhotoFile(f)
              }}
            />
          </div>
        )}

        {error && (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <SubscribeCta message={error} />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {savedWithoutPhoto ? (
            <button className="dacha-btn flex-1" onClick={() => { onLogged(type!); onClose() }}>
              Закрыть
            </button>
          ) : (
            <>
              <button type="button" className="dacha-chip flex-1 py-3" onClick={onClose}>
                Отмена
              </button>
              <button className="dacha-btn flex-1" disabled={!type || busy} onClick={save}>
                {busy ? '…' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
