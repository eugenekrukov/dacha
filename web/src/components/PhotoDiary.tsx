import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { PlantingPhoto } from '../api/types'
import AuthImage from './AuthImage'

export default function PhotoDiary({ plantingId }: { plantingId: number }) {
  const [photos, setPhotos] = useState<PlantingPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState<PlantingPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    api.getPhotos(plantingId)
      .then((p) => { if (!cancelled) setPhotos(p) })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить фото') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [plantingId])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // позволить повторно выбрать тот же файл
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const photo = await api.uploadPhoto(plantingId, file)
      setPhotos((prev) => [photo, ...prev])
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'photo_limit_reached'
        ? 'Достигнут лимит фото. Оформите подписку, чтобы добавить больше.'
        : 'Не удалось загрузить фото')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api.deletePhoto(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setViewer(null)
    } catch {
      setError('Не удалось удалить фото')
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black">Дневник</h2>
        <button
          type="button"
          className="dacha-chip flex items-center gap-1.5 px-3 py-2"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={18} aria-hidden /> {busy ? '…' : 'Добавить фото'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      </div>

      {error && <p className="mb-2 text-sm font-bold text-red-600">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-square animate-pulse rounded-btn bg-black/5" />)}
        </div>
      ) : photos.length === 0 ? (
        <p className="rounded-btn bg-background p-4 text-center text-sm text-muted">
          Пока нет фото. Снимите свою посадку — соберётся лента роста.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setViewer(p)} className="block">
              <AuthImage path={p.thumb_url} alt="Фото посадки" className="aspect-square w-full rounded-btn object-cover" />
            </button>
          ))}
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90" onClick={() => setViewer(null)}>
          <div className="flex justify-end p-4">
            <button type="button" aria-label="Закрыть" onClick={() => setViewer(null)} className="text-white">
              <X size={28} aria-hidden />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <AuthImage path={viewer.url} alt="Фото посадки" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
          <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-bold">{new Date(viewer.taken_at).toLocaleDateString('ru-RU')}</p>
              {viewer.caption && <p className="text-sm text-white/70">{viewer.caption}</p>}
            </div>
            <button type="button" aria-label="Удалить" onClick={() => remove(viewer.id)} className="text-red-400">
              <Trash2 size={24} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
