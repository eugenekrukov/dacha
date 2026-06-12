import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import type { Recommendation, TodayResponse } from '../api/types'

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

  useEffect(() => {
    if (gardenId === -1) return
    let cancelled = false
    setLoading(true)
    Promise.all([api.getToday(gardenId), api.getRecommendations(gardenId).catch(() => [])])
      .then(([t, r]) => {
        if (cancelled) return
        setToday(t)
        setRecs(r)
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Ошибка загрузки'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [gardenId])

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
              <span>
                {today.weather.temp_min != null && today.weather.temp_max != null
                  ? `${Math.round(today.weather.temp_min)}…${Math.round(today.weather.temp_max)}°`
                  : ''}
                {today.weather.precip_prob_pct != null ? ` · 💧 ${today.weather.precip_prob_pct}%` : ''}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              {today.weather.frost_risk && (
                <span className="rounded-pill bg-white/25 px-2 py-0.5 text-xs font-bold">❄ заморозки</span>
              )}
              {today.weather.heat_risk && (
                <span className="rounded-pill bg-white/25 px-2 py-0.5 text-xs font-bold">🔥 жара</span>
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
                  <span className="text-xs font-semibold text-tertiary">💧{d.precip_prob_pct}%</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {today && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">Задачи дня</h2>
          {today.tasks?.length ? (
            today.tasks.map((t, i) => (
              <div key={i} className="dacha-card flex flex-col p-4">
                <span className="font-bold">{t.care_task_name || t.type}</span>
                {t.crop_name && <span className="text-sm font-semibold text-muted">{t.crop_name}</span>}
                {t.product && <span className="text-sm text-tertiary">Препарат: {t.product}</span>}
              </div>
            ))
          ) : (
            <div className="dacha-card p-4 font-semibold text-muted">На сегодня задач нет 🎉</div>
          )}
        </section>
      )}

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
                className="shrink-0 text-lg font-black text-muted"
              >
                ×
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
