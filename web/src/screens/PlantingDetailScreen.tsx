import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { ACTION_TYPES, ACTION_LABELS, STAGE_LABELS, actionLabel, formatDate } from '../api/labels'
import type { ActionLog, ActionType, Planting } from '../api/types'

export default function PlantingDetailScreen() {
  const { id } = useParams()
  const plantingId = Number(id)
  const navigate = useNavigate()

  const [planting, setPlanting] = useState<Planting | null>(null)
  const [actions, setActions] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logType, setLogType] = useState<ActionType>('watering')
  const [logNote, setLogNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [p, a] = await Promise.all([
        api.getPlanting(plantingId),
        api.getActions(plantingId),
      ])
      setPlanting(p)
      setActions(a)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадку')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantingId])

  const log = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.logAction(plantingId, logType, logNote.trim() || undefined)
      setLogNote('')
      await load()
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

  const remove = async () => {
    if (!confirm('Удалить посадку?')) return
    try {
      await api.deletePlanting(plantingId)
      navigate('/plantings', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!planting) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  const expectedYield =
    planting.yield_per_plant_kg && planting.quantity
      ? Math.round(planting.yield_per_plant_kg * planting.quantity * 10) / 10
      : null

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="text-left font-bold text-muted">
        ← Назад
      </button>

      <div className="dacha-card flex flex-col gap-1 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">{planting.crop_name ?? `Посадка #${planting.id}`}</h1>
          <span className="dacha-chip bg-background text-xs text-tertiary">
            {STAGE_LABELS[planting.stage] ?? planting.stage}
          </span>
        </div>
        <p className="font-semibold text-muted">
          Посажено {formatDate(planting.planted_at)} · {planting.quantity ?? 1} шт.
          {planting.conditions === 'greenhouse' ? ' · теплица' : ''}
        </p>
        {expectedYield != null && (
          <p className="font-semibold text-tertiary">Ожидаемый урожай ~{expectedYield} кг</p>
        )}
      </div>

      <section className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-black">Записать действие</h2>
        <div className="flex flex-wrap gap-2">
          {ACTION_TYPES.map((t) => (
            <button
              key={t}
              className={`dacha-chip ${logType === t ? 'dacha-chip-active' : ''}`}
              onClick={() => setLogType(t)}
            >
              {ACTION_LABELS[t]}
            </button>
          ))}
        </div>
        <input
          className="dacha-input"
          placeholder="Заметка (необязательно)"
          value={logNote}
          onChange={(e) => setLogNote(e.target.value)}
        />
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <button className="dacha-btn" disabled={busy} onClick={log}>
          {busy ? '…' : 'Записать'}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black">История действий</h2>
        {actions.length === 0 ? (
          <div className="dacha-card p-4 font-semibold text-muted">Действий пока нет</div>
        ) : (
          actions.map((a) => (
            <div key={a.id} className="dacha-card flex items-center justify-between p-4">
              <div className="flex flex-col">
                <span className="font-bold">{actionLabel(a.action_type)}</span>
                {a.notes && !a.auto && (
                  <span className="text-sm font-semibold text-muted">{a.notes}</span>
                )}
              </div>
              <span className="text-sm font-semibold text-muted">{formatDate(a.logged_at)}</span>
            </div>
          ))
        )}
      </section>

      <button onClick={remove} className="mt-2 font-bold text-red-600">
        Удалить посадку
      </button>
    </div>
  )
}
