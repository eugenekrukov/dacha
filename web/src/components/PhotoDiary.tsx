import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { PlantingPhoto } from '../api/types'
import AuthImage from './AuthImage'
import { useModalA11y } from './Modal'
import SubscribeCta from './SubscribeCta'

// locked — посадка сверх free-набора без подписки: дневник виден, но новые кадры бэкенд не примет.
export default function PhotoDiary({ plantingId, locked = false }: { plantingId: number; locked?: boolean }) {
  const [photos, setPhotos] = useState<PlantingPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState<PlantingPhoto | null>(null)
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagError, setDiagError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<HTMLDivElement | null>(null)
  useModalA11y(viewerRef, () => setViewer(null), viewer != null)

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

  const runDiagnosis = async (photo: PlantingPhoto) => {
    setDiagBusy(true)
    setDiagError(null)
    try {
      const result = await api.diagnosePhoto(photo.id)
      const updated = { ...photo, ai_diagnosis: result.candidates, ai_diagnosed_at: result.diagnosed_at }
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? updated : p)))
      setViewer((v) => (v && v.id === photo.id ? updated : v))
    } catch (err) {
      setDiagError(err instanceof ApiError ? err.message : 'Не удалось определить болезнь/вредителя')
    } finally {
      setDiagBusy(false)
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
        {!locked && (
          <>
            <button
              type="button"
              className="dacha-chip flex items-center gap-1.5 px-3 py-2"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={18} aria-hidden /> {busy ? '…' : 'Добавить фото'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          </>
        )}
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
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDiagBusy(false)
                setDiagError(null)
                setViewer(p)
              }}
              className="block"
            >
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
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4" onClick={(e) => e.stopPropagation()}>
            <AuthImage path={viewer.url} alt="Фото посадки" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
          <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-bold">{new Date(viewer.taken_at).toLocaleDateString('ru-RU')}</p>
              {viewer.caption && <p className="text-sm text-white/70">{viewer.caption}</p>}
              {viewer.ai_diagnosis && viewer.ai_diagnosis.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5 rounded-btn bg-white/10 p-3">
                  {viewer.ai_diagnosis.map((c) => (
                    <p key={c.id} className="text-sm text-white">
                      <span className="font-bold">Похоже на: {c.name}</span>
                      <span className="text-white/70"> — {c.reasoning}</span>
                    </p>
                  ))}
                  <p className="text-xs text-white/50">Предварительная оценка ИИ — не заменяет консультацию агронома. Сверьтесь со справочником.</p>
                </div>
              ) : (
                <button
                  type="button"
                  className="dacha-chip mt-2 px-3 py-2 text-sm"
                  disabled={diagBusy}
                  onClick={() => runDiagnosis(viewer)}
                >
                  {diagBusy ? 'Определяю…' : '🔍 Определить болезнь/вредителя'}
                </button>
              )}
              {diagError && (
                <div className="mt-1 flex flex-col gap-1">
                  <p className="text-xs font-bold text-red-400">{diagError}</p>
                  <SubscribeCta message={diagError} />
                </div>
              )}
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
