import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import { formatDate } from '../api/labels'
import type { AnalyticsSummary, Harvest, Planting } from '../api/types'

export default function HarvestsScreen() {
  const { gardenId } = useGardens()
  const [harvests, setHarvests] = useState<Harvest[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plantingId, setPlantingId] = useState<number | ''>('')
  const [weight, setWeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (gardenId === -1) return
    try {
      const [h, p, s] = await Promise.all([
        api.getHarvests(gardenId),
        api.getPlantings(gardenId),
        api.getAnalytics(),
      ])
      setHarvests(h)
      setPlantings(p.filter((x) => x.stage !== 'done'))
      setSummary(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardenId])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (plantingId === '') {
      setError('Выберите посадку')
      return
    }
    setBusy(true)
    try {
      await api.addHarvest(plantingId, {
        weight_kg: weight ? Number(weight) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      })
      setWeight('')
      setQuantity('')
      setNotes('')
      await load()
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 402
            ? 'Нужна подписка или активный пробный период'
            : err.message
          : 'Не удалось добавить'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  const totalKg = harvests.reduce((s, h) => s + (h.weight_kg ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Урожай</h1>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Stat n={`${Math.round(totalKg * 10) / 10}`} l="кг собрано" />
          <Stat n={String(summary.total_harvests)} l="сборов" />
          <Stat n={String(summary.streak)} l="дней подряд" />
        </div>
      )}

      <form onSubmit={add} className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-black">Записать сбор</h2>
        <select
          className="dacha-input"
          value={plantingId}
          onChange={(e) => setPlantingId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">— посадка —</option>
          {plantings.map((p) => (
            <option key={p.id} value={p.id}>
              {p.crop_name ?? `Посадка #${p.id}`}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="dacha-input"
            type="number"
            min={0}
            step="0.1"
            placeholder="Вес, кг"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <input
            className="dacha-input"
            type="number"
            min={0}
            placeholder="Штук"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <input
          className="dacha-input"
          placeholder="Заметка (необязательно)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        <button className="dacha-btn" disabled={busy}>
          {busy ? '…' : 'Добавить'}
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black">История сборов</h2>
        {harvests.length === 0 ? (
          <div className="dacha-card p-4 font-semibold text-muted">Сборов пока нет</div>
        ) : (
          harvests.map((h) => (
            <div key={h.id} className="dacha-card flex items-center justify-between p-4">
              <div className="flex flex-col">
                <span className="font-bold">{h.crop_name ?? `Посадка #${h.planting_id}`}</span>
                <span className="text-sm font-semibold text-muted">
                  {[h.weight_kg ? `${h.weight_kg} кг` : null, h.quantity ? `${h.quantity} шт.` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  {h.notes ? ` — ${h.notes}` : ''}
                </span>
              </div>
              <span className="text-sm font-semibold text-muted">{formatDate(h.harvested_at)}</span>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="dacha-card flex flex-col items-center p-4">
      <span className="text-2xl font-black text-primary">{n}</span>
      <span className="text-center text-xs font-semibold text-muted">{l}</span>
    </div>
  )
}
