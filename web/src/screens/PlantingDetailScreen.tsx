import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { STAGE_LABELS, actionLabel, formatDate } from '../api/labels'
import { buildSchedule, type SchedStatus } from '../api/schedule'
import ActionLogSheet from '../components/ActionLogSheet'
import type { ActionLog, Crop, Planting } from '../api/types'

export default function PlantingDetailScreen() {
  const { id } = useParams()
  const plantingId = Number(id)
  const navigate = useNavigate()

  const [planting, setPlanting] = useState<Planting | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [actions, setActions] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)

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

      <button className="dacha-btn" onClick={() => setLogging(true)}>
        ✏️ Записать действие
      </button>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

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

      {logging && (
        <ActionLogSheet
          plantingId={plantingId}
          cropName={planting.crop_name}
          onClose={() => setLogging(false)}
          onLogged={() => {
            setLogging(false)
            load()
          }}
        />
      )}
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
