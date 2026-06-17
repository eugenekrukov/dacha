import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Droplet, Snowflake, Flame, Clock, CircleCheck, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import { careTaskActionType, treatmentNote } from '../api/schedule'
import { taskIcon } from '../ui/icons'
import ActionLogSheet from '../components/ActionLogSheet'
import type { Recommendation, TodayResponse, TodayTask } from '../api/types'

// Какое действие предвыбрать при записи из задачи дня
function preselectFor(t: TodayTask): { type: string | null; note?: string } {
  switch (t.type) {
    case 'watering_due':
      return { type: 'watering' }
    case 'fertilizing_due':
      return { type: 'fertilizing' }
    case 'transplant_due':
      return { type: 'transplanting' }
    case 'care_task_due':
      return {
        type: (t.care_task_name ? careTaskActionType(t.care_task_name) : null) ?? 'other',
        note: t.care_task_name ? treatmentNote(t.care_task_name) : undefined,
      }
    default:
      return { type: null }
  }
}

// Отклонённые на сегодня советы — в localStorage по дню (как dismissed-рекомендации в Android).
function dismissKey() {
  return `dacha_dismissed_recs_${new Date().toISOString().slice(0, 10)}`
}
function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissKey()) || '[]'))
  } catch {
    return new Set()
  }
}
function recKey(r: Recommendation) {
  return `${r.type}:${r.crop_name ?? ''}:${r.message.slice(0, 30)}`
}

export default function TodayScreen() {
  const { active, gardenId } = useGardens()
  const [today, setToday] = useState<TodayResponse | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logTask, setLogTask] = useState<TodayTask | null>(null)

  const load = useCallback(() => {
    if (gardenId === -1) return
    setLoading(true)
    Promise.all([api.getToday(gardenId), api.getRecommendations(gardenId).catch(() => [])])
      .then(([t, r]) => {
        setToday(t)
        setRecs(r)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [gardenId])

  useEffect(() => {
    load()
  }, [load])

  const dismiss = (r: Recommendation) => {
    const next = new Set(dismissed)
    next.add(recKey(r))
    setDismissed(next)
    localStorage.setItem(dismissKey(), JSON.stringify([...next]))
  }

  const visibleRecs = recs.filter((r) => !dismissed.has(recKey(r)))

  return (
    <div className="flex flex-col gap-4">
      <div className="dacha-card bg-gradient-to-br from-primary to-[#FF9E3D] p-5 text-white">
        <p className="text-sm font-bold uppercase opacity-90">Сегодня</p>
        <h1 className="text-2xl font-black">{active?.name ?? 'Мой участок'}</h1>
        {active?.city && <p className="font-semibold opacity-90">{active.city}</p>}
        {today?.weather && (
          <div className="mt-3 flex items-center gap-3 border-t border-white/25 pt-3">
            {today.weather.temp_c != null && (
              <span className="text-3xl font-black">{Math.round(today.weather.temp_c)}°</span>
            )}
            <div className="flex flex-col text-sm font-semibold opacity-95">
              {today.weather.condition_text && <span>{today.weather.condition_text}</span>}
              <span className="flex items-center gap-1">
                {today.weather.temp_min != null && today.weather.temp_max != null
                  ? `${Math.round(today.weather.temp_min)}…${Math.round(today.weather.temp_max)}°`
                  : ''}
                {today.weather.precip_prob_pct != null && (
                  <>
                    {' · '}
                    <Droplet size={15} aria-hidden /> {today.weather.precip_prob_pct}%
                  </>
                )}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              {today.weather.frost_risk && (
                <span className="flex items-center gap-1 rounded-pill bg-white/25 px-2 py-0.5 text-xs font-bold">
                  <Snowflake size={13} aria-hidden /> заморозки
                </span>
              )}
              {today.weather.heat_risk && (
                <span className="flex items-center gap-1 rounded-pill bg-white/25 px-2 py-0.5 text-xs font-bold">
                  <Flame size={13} aria-hidden /> жара
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && <p className="font-bold text-muted">Загрузка…</p>}
      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      {today?.forecast && today.forecast.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">Прогноз</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {today.forecast.slice(0, 7).map((d, i) => (
              <div
                key={i}
                className="dacha-card flex min-w-[68px] flex-col items-center gap-0.5 p-3 text-center"
              >
                <span className="text-xs font-bold uppercase text-muted">
                  {new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short' })}
                </span>
                <span className="font-black">
                  {d.max_temp_c != null ? `${Math.round(d.max_temp_c)}°` : '—'}
                </span>
                <span className="text-xs font-semibold text-muted">
                  {d.min_temp_c != null ? `${Math.round(d.min_temp_c)}°` : ''}
                </span>
                {d.precip_prob_pct != null && d.precip_prob_pct > 0 && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-tertiary">
                    <Droplet size={12} aria-hidden />
                    {d.precip_prob_pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {today && (() => {
        const currentTasks  = today.tasks?.filter(t => !t.days_until) ?? []
        const upcomingTasks = today.tasks?.filter(t => (t.days_until ?? 0) > 0) ?? []
        return (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-black">Задачи дня</h2>
              {currentTasks.length ? (
                currentTasks.map((t, i) => <TaskCard key={i} t={t} onLog={setLogTask} />)
              ) : (
                <div className="dacha-card flex items-center gap-2 p-4 font-semibold text-muted">
                  <CircleCheck size={20} aria-hidden className="text-tertiary" /> На сегодня задач нет
                </div>
              )}
            </section>
            {upcomingTasks.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-black">Скоро</h2>
                {upcomingTasks.map((t, i) => <TaskCard key={i} t={t} />)}
              </section>
            )}
          </>
        )
      })()}

      {visibleRecs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">Советы дня</h2>
          {visibleRecs.map((r, i) => (
            <div key={i} className="dacha-card flex items-start justify-between gap-3 p-4">
              <div className="flex flex-col">
                {r.crop_name && (
                  <span className="text-sm font-bold text-tertiary">{r.crop_name}</span>
                )}
                <span className="font-semibold">{r.message}</span>
              </div>
              <button
                onClick={() => dismiss(r)}
                aria-label="Скрыть совет"
                className="shrink-0 text-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
          ))}
        </section>
      )}

      {logTask && (logTask.planting_id != null || !!logTask.crop_names_with_ids?.length) && (
        <ActionLogSheet
          plantingId={logTask.planting_id ?? undefined}
          cropName={logTask.crop_name}
          plantings={logTask.crop_names_with_ids ?? undefined}
          title={logTask.crop_names_with_ids?.length ? (logTask.care_task_name ?? undefined) : undefined}
          preselectedType={preselectFor(logTask).type}
          initialNote={preselectFor(logTask).note}
          onClose={() => setLogTask(null)}
          onLogged={() => {
            setLogTask(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function TaskCard({ t, onLog }: { t: TodayTask; onLog?: (t: TodayTask) => void }) {
  const overdue = (t.days_overdue ?? 0) > 0
  const critical = t.type === 'frost_alert' // только заморозки — действительно срочно (красный)
  const grouped = (t.crop_names_with_ids?.length ?? 0) > 0
  const clickable = (t.planting_id != null || grouped) && !!onLog
  const careType = t.type === 'care_task_due' && t.care_task_name ? careTaskActionType(t.care_task_name) : null
  const Icon = taskIcon(t.type, careType)
  const body = (
    <>
      <Icon size={26} className="shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="font-bold">{t.title}</span>
        {t.description && <span className="text-sm font-semibold text-muted">{t.description}</span>}
        {t.product && <span className="text-sm font-semibold text-tertiary">Препарат: {t.product}</span>}
        {clickable && t.planting_id != null && (
          <Link
            to={`/plantings/${t.planting_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-link mt-1 w-fit text-sm"
          >
            Подробнее →
          </Link>
        )}
      </div>
      {overdue && (
        <span
          className={`ml-auto flex shrink-0 items-center gap-1 self-start rounded-pill px-2 py-0.5 text-xs font-bold ${
            critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
          }`}
        >
          <Clock size={13} aria-hidden /> {t.days_overdue} дн.
        </span>
      )}
    </>
  )
  const cls = 'flex items-start gap-3 p-4'
  if (!clickable) return <div className={`dacha-card ${cls}`}>{body}</div>
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onLog(t)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onLog(t)
      }}
      className={`dacha-card-link cursor-pointer ${cls}`}
    >
      {body}
    </div>
  )
}
