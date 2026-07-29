import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import AuthImage from '../components/AuthImage'
import { Camera, Trash2 } from 'lucide-react'
import type { Crop, Seed } from '../api/types'

// Пакетик пишет срок месяцем («годен до 12.2027»), бэкенд хранит датой.
// Наружу показываем месяц — в формате, в котором его читают с пакетика.
function formatExpiry(iso: string | null): string {
  if (!iso) return 'срок не указан'
  const [y, m] = iso.split('-')
  return `годен до ${m}.${y}`
}

// Значение для <input type="month">: YYYY-MM.
function toMonthInput(iso: string | null): string {
  return iso ? iso.slice(0, 7) : ''
}

export default function SeedsScreen() {
  const [seeds, setSeeds] = useState<Seed[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cropName, setCropName] = useState('')
  const [variety, setVariety] = useState('')
  const [expires, setExpires] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    try {
      const [s, c] = await Promise.all([api.getSeeds(), api.getCrops()])
      setSeeds(s)
      setCrops(c)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить семена')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!cropName.trim()) {
      setError('Укажите культуру')
      return
    }
    setBusy(true)
    try {
      const seed = await api.createSeed({
        crop_name: cropName.trim(),
        variety: variety.trim() || null,
        expires_on: expires || null,
      })
      if (file) await api.uploadSeedPhoto(seed.id, file)
      setCropName('')
      setVariety('')
      setExpires('')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить пакетик')
    } finally {
      setBusy(false)
    }
  }

  const changeExpiry = async (seed: Seed, month: string) => {
    setError(null)
    try {
      const updated = await api.updateSeed(seed.id, { expires_on: month || null })
      setSeeds((prev) => prev.map((s) => (s.id === seed.id ? updated : s)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить срок')
    }
  }

  const addPhoto = async (seed: Seed, f: File) => {
    setError(null)
    try {
      const updated = await api.uploadSeedPhoto(seed.id, f)
      setSeeds((prev) => prev.map((s) => (s.id === seed.id ? updated : s)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить фото')
    }
  }

  const remove = async (seed: Seed) => {
    if (!confirm(`Убрать «${seed.crop_name}» из инвентаря?`)) return
    try {
      await api.deleteSeed(seed.id)
      setSeeds((prev) => prev.filter((s) => s.id !== seed.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  const expiredCount = seeds.filter((s) => s.expired).length

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Мои семена</h1>
      <p className="-mt-2 text-sm font-semibold text-muted">
        Что уже лежит в коробке — чтобы не купить второй раз и вовремя заметить просроченный пакетик.
      </p>

      {expiredCount > 0 && (
        <div className="rounded-card bg-[#D32F2F]/10 px-4 py-3 font-bold text-[#B71C1C]">
          Просрочено пакетиков: {expiredCount}. Всхожесть уже не та — проверьте перед посевом.
        </div>
      )}

      {error && <p className="font-bold text-[#D32F2F]">{error}</p>}

      <form onSubmit={add} className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-black">Добавить пакетик</h2>
        <input
          className="dacha-input"
          list="crops-list"
          placeholder="Культура (например, Томат)"
          value={cropName}
          onChange={(e) => setCropName(e.target.value)}
        />
        {/* Подсказки из справочника, но ввод свободный: в коробке лежат и цветы, которых в нём нет */}
        <datalist id="crops-list">
          {crops.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <input
          className="dacha-input"
          placeholder="Сорт (например, Бычье сердце)"
          value={variety}
          onChange={(e) => setVariety(e.target.value)}
        />
        <label className="flex flex-col gap-1 text-sm font-bold text-muted">
          Годен до (месяц с пакетика)
          <input
            className="dacha-input"
            type="month"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        <input
          ref={fileInput}
          className="text-sm font-semibold"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="dacha-btn" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Добавить'}
        </button>
      </form>

      {seeds.length === 0 ? (
        <p className="font-bold text-muted">Пока пусто. Сфотографируйте пакетик — и он тут появится.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {seeds.map((seed) => (
            <li key={seed.id} className="dacha-card flex items-start gap-3 p-4">
              {seed.thumb_url ? (
                <AuthImage
                  path={seed.thumb_url}
                  alt={`Пакетик: ${seed.crop_name}`}
                  className="h-20 w-20 shrink-0 rounded-btn object-cover"
                />
              ) : (
                <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-btn border border-dashed border-black/20 text-[10px] font-bold text-muted">
                  <Camera size={18} aria-hidden />
                  Фото
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) addPhoto(seed, f)
                    }}
                  />
                </label>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-black">{seed.crop_name}</span>
                {seed.variety && <span className="truncate text-sm font-bold text-muted">{seed.variety}</span>}
                <span
                  className={`text-sm font-bold ${
                    seed.expired ? 'text-[#D32F2F]' : seed.expires_this_year ? 'text-[#B26A00]' : 'text-muted'
                  }`}
                >
                  {seed.expired
                    ? `Просрочен — ${formatExpiry(seed.expires_on)}`
                    : seed.expires_this_year
                      ? `Использовать в этом сезоне — ${formatExpiry(seed.expires_on)}`
                      : formatExpiry(seed.expires_on)}
                </span>
                <input
                  className="mt-1 h-9 w-[150px] rounded-btn border border-black/10 px-2 text-sm font-semibold outline-none focus:border-primary"
                  type="month"
                  aria-label={`Срок годности: ${seed.crop_name}`}
                  value={toMonthInput(seed.expires_on)}
                  onChange={(e) => changeExpiry(seed, e.target.value)}
                />
              </div>

              <button
                onClick={() => remove(seed)}
                aria-label={`Удалить ${seed.crop_name}`}
                className="shrink-0 rounded-btn p-2 text-muted transition hover:bg-black/5"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
