import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import type { GeocodeSuggestion } from '../api/types'

export default function CreateGardenScreen() {
  const navigate = useNavigate()
  const { reload } = useGardens()

  const [name, setName] = useState('Мой участок')
  const [cityQuery, setCityQuery] = useState('')
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
    if (!picked) {
      setError('Выберите город из списка')
      return
    }
    setBusy(true)
    try {
      await api.createGarden({
        name: name.trim() || 'Мой участок',
        city: picked.name,
        region: picked.display_name.split(',').slice(1).join(',').trim() || undefined,
        climate_zone: picked.zone ?? undefined,
      })
      await reload()
      navigate('/today', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать участок')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="dacha-card w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-black text-primary">Новый участок</h1>
        <p className="mb-6 font-semibold text-muted">
          Укажите название и город — по нему подтянем погоду и климатическую зону.
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
            {busy ? '…' : 'Создать участок'}
          </button>
        </form>
      </div>
    </div>
  )
}
