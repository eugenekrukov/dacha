import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { ACTION_TYPES, ACTION_LABELS, STAGE_LABELS, actionLabel, formatDate } from '../api/labels'
import { buildSchedule, type SchedStatus } from '../api/schedule'
import type { ActionLog, ActionType, Crop, Planting } from '../api/types'

export default function PlantingDetailScreen() {
  const { id } = useParams()
  const plantingId = Number(id)
  const navigate = useNavigate()

  const [planting, setPlanting] = useState<Planting | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [actions, setActions] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logType, setLogType] = useState<ActionType>('watering')
  const [logNote, setLogNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [p, a] = await Promise.all([api.getPlanting(plantingId), api.getActions(plantingId)])
      setPlanting(p)
      setActions(a)
      // care_tasks/transplant_days для расписания приходят в /crops/:id (SELECT *)
      const c = await api.getCrop(p.crop_id).catch(() => null)
      setCrop(c)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадку')
    } finally {
      setLoading(false)
    }
  }

  const schedule = useMemo(() => {
    if (!planting?.planted_at || !crop) return []
    return buildSchedule({
      transplantDays: crop.transplant_days,
      careTasks: crop.care_tasks,
      harvestDays: crop.harvest_days,
      wateringFreqDays: crop.watering_freq_days,
      conditions: planting.conditions,
      sowingMethod: planting.sowing_method,
      planted: new Date(planting.planted_at),
      actions,
      today: new Date(),
    })
  }, [planting, crop, actions])

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

      {schedule.length > 0 && (
        <section className="dacha-card flex flex-col gap-1.5 p-5">
          <h2 className="text-lg font-black">Расписание работ</h2>
          <p className="mb-1 text-xs font-semibold text-muted">
            🟢 выполнено · 🔴 просрочено · ⚪ предстоит
          </p>
          {schedule.map((row, i) => (
            <SchedRowView key={i} row={row} />
          ))}
        </section>
      )}

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

const SCHED_MARKER: Record<SchedStatus, string> = {
  done: '🟢 ',
  missed: '🔴 ',
  upcoming: '⚪ ',
  neutral: '',
}

function SchedRowView({ row }: { row: import('../api/schedule').SchedRow }) {
  const color =
    row.status === 'missed'
      ? 'text-red-600'
      : row.status === 'upcoming'
        ? 'text-[#3a2a1a]'
        : 'text-muted'
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/5 py-1.5 last:border-0">
      <div className="flex flex-col">
        <span
          className={`font-semibold ${color} ${row.status === 'done' ? 'line-through' : ''}`}
        >
          {SCHED_MARKER[row.status]}
          {row.name}
        </span>
        {row.product && (
          <span className="text-xs font-semibold text-tertiary">Препарат: {row.product}</span>
        )}
      </div>
      <span className={`shrink-0 font-semibold ${color} ${row.status === 'missed' ? 'font-black' : ''}`}>
        {row.dateStr}
      </span>
    </div>
  )
}
