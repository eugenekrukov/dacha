import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import { categoryLabel } from '../api/labels'
import type { Crop } from '../api/types'

// Онбординг-выбор стартовых культур (зеркало Android OnboardingCropsScreen):
// после создания участка предлагаем выбрать культуры и батчем создаём посадки.
export default function OnboardingCropsScreen() {
  const navigate = useNavigate()
  const { active, loading: gardensLoading } = useGardens()

  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // Нет участка (прямой заход по URL) — онбординг бессмыслен, уводим на «Сегодня».
  // Ждём окончания загрузки садов, иначе редирект сработает на null во время загрузки.
  useEffect(() => {
    if (!gardensLoading && !active) navigate('/today', { replace: true })
  }, [gardensLoading, active, navigate])

  useEffect(() => {
    api
      .getCrops()
      .then(setCrops)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить культуры'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(crops.map((c) => c.category).filter(Boolean))) as string[],
    [crops],
  )

  const q = search.trim().toLowerCase()
  const visible = q
    ? crops.filter((c) => c.name.toLowerCase().includes(q))
    : category
      ? crops.filter((c) => c.category === category)
      : crops

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addSelected = async () => {
    if (selected.size === 0 || !active) {
      navigate('/today', { replace: true })
      return
    }
    setSaving(true)
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    try {
      await Promise.all(
        [...selected].map((cropId) =>
          api.createPlanting({ garden_id: active.id, crop_id: cropId, planted_at: today }),
        ),
      )
      // Даты выставлены = сегодня без явного выбора — пользователь сможет поправить в «Посадках».
      navigate('/plantings', { replace: true })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 402
            ? 'Нужна подписка или активный пробный период'
            : err.message
          : 'Не удалось добавить посадки'
      setError(msg)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-6 py-6">
      <div className="flex flex-col items-center text-center">
        <span className="text-5xl" aria-hidden>🌱</span>
        <h1 className="mt-2 text-2xl font-black">Что вы выращиваете?</h1>
        <p className="font-semibold text-muted">Выберите культуры — добавим их в посадки</p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center font-bold text-muted">Загрузка…</div>
      ) : (
        <>
          <div className="relative mt-4">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              className="dacha-input pl-10 pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск культуры…"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                aria-label="Очистить"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-btn p-1 text-muted hover:bg-background"
                onClick={() => setSearch('')}
              >
                <X size={18} aria-hidden />
              </button>
            )}
          </div>

          {!search && categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={`dacha-chip ${category === null ? 'dacha-chip-active' : ''}`}
                onClick={() => setCategory(null)}
              >
                Все
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  className={`dacha-chip ${category === c ? 'dacha-chip-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {categoryLabel(c)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex h-full items-center justify-center font-semibold text-muted">
                {q ? `Ничего не найдено по «${search.trim()}»` : 'Культуры не найдены'}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 pb-2 sm:grid-cols-4">
                {visible.map((c) => {
                  const on = selected.has(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`min-h-[48px] rounded-card border px-2 py-2 text-center text-xs font-bold leading-tight transition ${
                        on
                          ? 'border-primary bg-primary text-white'
                          : 'border-black/10 bg-white text-[#3a2a1a] hover:bg-background'
                      }`}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-center text-sm font-bold text-red-600">{error}</p>}

          <button className="dacha-btn mt-3 h-[52px] shrink-0" disabled={saving} onClick={addSelected}>
            {saving ? '…' : selected.size === 0 ? 'Пропустить' : `Добавить (${selected.size})`}
          </button>
        </>
      )}
    </div>
  )
}
