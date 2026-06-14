import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { actionLabel, formatDate } from '../api/labels'
import { collapseActions } from '../api/schedule'
import type { ActionLog } from '../api/types'

export default function JournalScreen() {
  const [actions, setActions] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    api
      .getAllActions()
      .then(setActions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал'))
      .finally(() => setLoading(false))
  }, [])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await api.fetchActionsCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'actions.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выгрузить CSV')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Журнал действий</h1>
        {actions.length > 0 && (
          <button className="dacha-btn h-10 px-4" disabled={exporting} onClick={exportCsv}>
            {exporting ? '…' : '⤓ CSV'}
          </button>
        )}
      </div>

      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      {actions.length === 0 && !error ? (
        <div className="dacha-card p-6 text-center font-semibold text-muted">Действий пока нет</div>
      ) : (
        collapseActions(actions.filter((a) => !a.auto)).map((g) => (
          <div key={g.id} className="dacha-card flex items-center justify-between p-4">
            <div className="flex flex-col">
              <span className="font-bold">
                {actionLabel(g.action_type)}
                {g.crop_name ? ` · ${g.crop_name}` : ''}
                {g.count > 1 ? ` ×${g.count}` : ''}
              </span>
              {g.note && <span className="text-sm font-semibold text-muted">{g.note}</span>}
            </div>
            <span className="text-sm font-semibold text-muted">
              {g.count > 1 ? `${formatDate(g.firstAt)}–${formatDate(g.lastAt)}` : formatDate(g.lastAt)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
