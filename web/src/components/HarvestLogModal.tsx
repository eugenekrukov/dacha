import { useState } from 'react'
import { api, ApiError } from '../api/client'
import Modal from './Modal'

export default function HarvestLogModal({
  plantingId,
  cropName,
  onClose,
  onLogged,
}: {
  plantingId: number
  cropName?: string | null
  onClose: () => void
  onLogged: () => void
}) {
  const [weight, setWeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [finishSeason, setFinishSeason] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.addHarvest(plantingId, {
        weight_kg: weight ? Number(weight) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      })
      if (finishSeason) await api.updateStage(plantingId, 'done')
      onLogged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} className="flex w-full max-w-sm flex-col gap-3 p-5">
      <h2 className="font-black">Записать урожай{cropName ? `: ${cropName}` : ''}</h2>
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
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={finishSeason}
          onChange={(e) => setFinishSeason(e.target.checked)}
        />
        Это весь урожай в этом сезоне
      </label>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button className="dacha-chip flex-1 py-3" onClick={onClose}>
          Отмена
        </button>
        <button
          className="dacha-btn flex-1"
          disabled={busy || (!weight && !quantity)}
          onClick={save}
        >
          {busy ? '…' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}
