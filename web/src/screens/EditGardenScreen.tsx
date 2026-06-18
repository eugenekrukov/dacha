import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import type { GeocodeSuggestion } from '../api/types'

// Редактирование активного участка: название + город (с автодополнением, как при создании).
// Если город не меняли — сохраняем прежние city/region/climate_zone участка.
export default function EditGardenScreen() {
  const navigate = useNavigate()
  const { active, reload } = useGardens()

  const [name, setName] = useState(active?.name ?? 'Мой участок')
  const [cityQuery, setCityQuery] = useState(active?.city ?? '')
  const [picked, setPicked] = useState<GeocodeSuggestion | null>(null)
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const skipNextFetch = useRef(false)

  // Дебаунс автодополнения города (Photon через /geocode/suggest)
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false
      return
    }
    const q = cityQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      try {
        setSuggestions(await api.geocodeSuggest(q))
      } catch {
        setSuggestions([])
      }
    }, 350)
    return () => clearTimeout(t)
  }, [cityQuery])

  const pick = (s: GeocodeSuggestion) => {
    setPicked(s)
    skipNextFetch.current = true
    setCityQuery(s.display_name)
    setSuggestions([])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!active) return
    setBusy(true)
    try {
      // Город перевыбрали из списка → новые координаты/зона; иначе оставляем прежние.
      const body = picked
        ? {
            name: name.trim() || 'Мой участок',
            city: picked.name,
            region: picked.display_name.split(',').slice(1).join(',').trim() || undefined,
            climate_zone: picked.zone ?? undefined,
          }
        : {
            name: name.trim() || 'Мой участок',
            city: active.city ?? undefined,
            region: active.region ?? undefined,
            climate_zone: active.climate_zone ?? undefined,
          }
      await api.updateGarden(active.id, body)
      await reload()
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить участок')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-left font-bold text-muted"
      >
        <ArrowLeft size={18} aria-hidden /> Назад
      </button>

      <div className="dacha-card w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-black text-primary">Участок</h1>
        <p className="mb-6 font-semibold text-muted">
          Измените название или город — по городу обновим погоду и климатическую зону.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm font-bold text-muted">Название</label>
          <input
            className="dacha-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мой участок"
          />

          <label className="mt-2 text-sm font-bold text-muted">Город</label>
          <div className="relative">
            <input
              className="dacha-input"
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value)
                setPicked(null)
              }}
              placeholder="Начните вводить…"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-btn border border-black/10 bg-white shadow-card">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left font-semibold hover:bg-background"
                      onClick={() => pick(s)}
                    >
                      {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button className="dacha-btn mt-4" disabled={busy}>
            {busy ? '…' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}
