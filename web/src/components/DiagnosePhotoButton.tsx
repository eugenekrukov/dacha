import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { AiDiagnosisCandidate } from '../api/types'
import SubscribeCta from './SubscribeCta'

// Быстрый вход в AI-диагностику прямо с вкладок «Болезни»/«Вредители»: снял/выбрал фото —
// сразу же загрузили и продиагностировали одним действием, без похода в «Дневник».
// Диагноз (closed-set) охватывает и болезни, и вредителей культуры разом, поэтому кнопка
// одинаковая на обеих вкладках — угадать заранее, что покажет фото, нельзя.
export default function DiagnosePhotoButton({ plantingId, locked = false }: { plantingId: number; locked?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ candidates: AiDiagnosisCandidate[]; disclaimer: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const photo = await api.uploadPhoto(plantingId, file)
      const diag = await api.diagnosePhoto(photo.id)
      setResult({ candidates: diag.candidates, disclaimer: diag.disclaimer })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось определить болезнь/вредителя')
    } finally {
      setBusy(false)
    }
  }

  if (locked) return null

  return (
    <div className="dacha-card mb-3 flex flex-col gap-2 p-4">
      <button
        type="button"
        className="dacha-btn flex items-center justify-center gap-2"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Camera size={18} aria-hidden /> {busy ? 'Определяю…' : 'Определить болезнь по фото'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />

      {result && (
        <div className="flex flex-col gap-1.5">
          {result.candidates.length === 0 ? (
            <p className="text-sm text-muted">Не удалось однозначно определить — сверьтесь со справочником ниже.</p>
          ) : (
            result.candidates.map((c) => (
              <p key={c.id} className="text-sm">
                <span className="font-bold">Похоже на: {c.name}</span>
                <span className="text-muted"> — {c.reasoning}</span>
              </p>
            ))
          )}
          <p className="text-xs text-muted">{result.disclaimer}</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-red-600">{error}</p>
          <SubscribeCta message={error} />
        </div>
      )}
    </div>
  )
}
