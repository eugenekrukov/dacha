import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import AuthImage from '../components/AuthImage'
import Modal from '../components/Modal'
import { Camera, Pencil, Trash2, X } from 'lucide-react'
import type { Crop, Seed, SeedShoppingItem } from '../api/types'

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
  const [shoppingList, setShoppingList] = useState<SeedShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cropName, setCropName] = useState('')
  const [variety, setVariety] = useState('')
  const [expires, setExpires] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [editing, setEditing] = useState<Seed | null>(null)
  const [viewing, setViewing] = useState<Seed | null>(null)
  const cropNameInput = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    try {
      const [s, c, sl] = await Promise.all([api.getSeeds(), api.getCrops(), api.getSeedsShoppingList()])
      setSeeds(s)
      setCrops(c)
      setShoppingList(sl)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить семена')
    } finally {
      setLoading(false)
    }
  }

  // Клик по автообнаруженной культуре в «Списке покупок» — подставляет её в форму добавления.
  const fillFromShoppingList = (name: string) => {
    setCropName(name)
    cropNameInput.current?.focus()
  }

  const [wishInput, setWishInput] = useState('')
  const [wishBusy, setWishBusy] = useState(false)

  // Добавить произвольную культуру в список покупок (wanted:true) — не привязана к посадкам.
  const addWish = async () => {
    const name = wishInput.trim()
    if (!name) return
    setWishBusy(true)
    try {
      await api.createSeed({ crop_name: name, wanted: true })
      setWishInput('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить в список покупок')
    } finally {
      setWishBusy(false)
    }
  }

  // «Куплено» — снимает wanted, позиция становится обычным пакетиком в коробке.
  const markBought = async (id: number) => {
    try {
      await api.updateSeed(id, { wanted: false })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отметить купленным')
    }
  }

  const removeWish = async (item: SeedShoppingItem) => {
    if (item.id == null) return
    try {
      await api.deleteSeed(item.id)
      setShoppingList((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось убрать из списка')
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

  // Правка всех полей пакетика, а не только срока: PATCH /seeds/:id принимал crop_name
  // и variety с самого начала, но в вебе редактировать их было нечем — единственным
  // изменяемым полем было «годен до» в карточке (замечание владельца 2026-07-30).
  const saveEdit = async (id: number, patch: { crop_name: string; variety: string | null; expires_on: string | null }) => {
    setError(null)
    try {
      const updated = await api.updateSeed(id, patch)
      setSeeds((prev) => prev.map((s) => (s.id === id ? updated : s)))
      setEditing(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить изменения')
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

      <div className="dacha-card flex flex-col gap-2 p-4">
        <h2 className="font-black">Список покупок</h2>
        <p className="text-sm font-semibold text-muted">
          Растёт на участке без семян в коробке — само подсказало ниже. Плюс сюда можно вписать
          что угодно, чего ещё нет: новый сорт, культуру на будущий сезон.
        </p>

        {shoppingList.some((i) => !i.manual) && (
          <div className="flex flex-wrap gap-2">
            {shoppingList.filter((i) => !i.manual).map((item) => (
              <button
                key={`auto-${item.crop_id}`}
                type="button"
                className="rounded-pill bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
                onClick={() => fillFromShoppingList(item.crop_name)}
              >
                + {item.crop_name}
              </button>
            ))}
          </div>
        )}

        {shoppingList.some((i) => i.manual) && (
          <ul className="flex flex-col gap-1.5">
            {shoppingList.filter((i) => i.manual).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-btn bg-background px-3 py-2">
                <span className="text-sm font-semibold">
                  {item.crop_name}
                  {item.variety ? ` · ${item.variety}` : ''}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className="text-xs font-bold text-primary"
                    onClick={() => item.id != null && markBought(item.id)}
                  >
                    Куплено
                  </button>
                  <button
                    type="button"
                    aria-label={`Убрать «${item.crop_name}» из списка`}
                    className="rounded-btn p-1 text-muted hover:bg-black/5"
                    onClick={() => removeWish(item)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1.5">
          <input
            className="dacha-input flex-1 py-1.5 text-sm"
            list="crops-list"
            placeholder="Добавить культуру в список (например, Бархатцы)"
            value={wishInput}
            onChange={(e) => setWishInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWish()}
          />
          <button
            type="button"
            className="dacha-chip px-3 py-1.5 text-sm"
            disabled={wishBusy || !wishInput.trim()}
            onClick={addWish}
          >
            Добавить
          </button>
        </div>
      </div>

      <form onSubmit={add} className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-black">Добавить пакетик</h2>
        <input
          ref={cropNameInput}
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
                // Тап по миниатюре открывает фото целиком: на пакетике мелким шрифтом
                // напечатано ровно то, ради чего его снимали (сорт, производитель, срок).
                <button
                  type="button"
                  onClick={() => setViewing(seed)}
                  aria-label={`Открыть фото: ${seed.crop_name}`}
                  className="shrink-0"
                >
                  <AuthImage
                    path={seed.thumb_url}
                    alt={`Пакетик: ${seed.crop_name}`}
                    className="h-20 w-20 rounded-btn object-cover"
                  />
                </button>
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
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setEditing(seed)}
                  aria-label={`Изменить ${seed.crop_name}`}
                  className="rounded-btn p-2 text-muted transition hover:bg-black/5"
                >
                  <Pencil size={18} aria-hidden />
                </button>
                <button
                  onClick={() => remove(seed)}
                  aria-label={`Удалить ${seed.crop_name}`}
                  className="rounded-btn p-2 text-muted transition hover:bg-black/5"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditSeedModal
          seed={editing}
          crops={crops}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {viewing?.photo_url && (
        // ponytail: свой оверлей, а не общий компонент — у PhotoDiary просмотрщик со своим
        // удалением и датой съёмки, объединять две штуки ради 10 строк разметки незачем.
        // Появится третий — выносить в components/PhotoLightbox.tsx.
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setViewing(null)}
        >
          <div className="flex justify-end p-4">
            <button type="button" aria-label="Закрыть" onClick={() => setViewing(null)} className="text-white">
              <X size={28} aria-hidden />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <AuthImage
              path={viewing.photo_url}
              alt={`Пакетик: ${viewing.crop_name}`}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
          <p className="p-4 font-bold text-white" onClick={(e) => e.stopPropagation()}>
            {[viewing.crop_name, viewing.variety].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}

function EditSeedModal({
  seed,
  crops,
  onClose,
  onSave,
}: {
  seed: Seed
  crops: Crop[]
  onClose: () => void
  onSave: (id: number, patch: { crop_name: string; variety: string | null; expires_on: string | null }) => void
}) {
  const [cropName, setCropName] = useState(seed.crop_name)
  const [variety, setVariety] = useState(seed.variety ?? '')
  const [expires, setExpires] = useState(toMonthInput(seed.expires_on))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!cropName.trim()) return
    onSave(seed.id, {
      crop_name: cropName.trim(),
      variety: variety.trim() || null,
      expires_on: expires || null,
    })
  }

  return (
    <Modal onClose={onClose} className="flex w-full max-w-md flex-col gap-3 p-5">
      <h2 className="text-lg font-black">Пакетик</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className="dacha-input"
          list="crops-list-edit"
          placeholder="Культура"
          value={cropName}
          onChange={(e) => setCropName(e.target.value)}
        />
        <datalist id="crops-list-edit">
          {crops.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <input
          className="dacha-input"
          placeholder="Сорт"
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
        <div className="flex gap-2">
          <button type="submit" className="dacha-btn flex-1">Сохранить</button>
          <button type="button" onClick={onClose} className="dacha-chip flex-1 py-3">Отмена</button>
        </div>
      </form>
    </Modal>
  )
}
