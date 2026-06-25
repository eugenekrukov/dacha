import { useState } from 'react'
import { api, ApiError } from '../api/client'
import Modal from './Modal'

export default function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      await api.deleteAccount(password)
      onDeleted()
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password' ? 'Неверный пароль' : 'Не удалось удалить аккаунт',
      )
    } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} className="w-full max-w-sm p-5">
      <h2 className="mb-2 font-black text-red-600">Удалить аккаунт</h2>
      <p className="mb-3 text-sm font-semibold text-muted">
        Это действие необратимо. Будут удалены ваши участки, посадки, журнал и история. Восстановить данные будет нельзя.
      </p>
      <input
        type="password" placeholder="Введите пароль для подтверждения" value={password}
        onChange={(e) => setPassword(e.target.value)} className="dacha-input w-full" autoComplete="current-password"
      />
      {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
        <button
          className="flex-1 rounded-pill bg-red-600 py-3 font-bold text-white disabled:opacity-50"
          disabled={busy || !password} onClick={submit}
        >
          Удалить навсегда
        </button>
      </div>
    </Modal>
  )
}
