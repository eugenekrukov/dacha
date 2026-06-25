import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { actionLabel, formatDate } from '../api/labels'
import { collapseActions, type ActionGroup } from '../api/schedule'
import { actionIcon } from '../ui/icons'
import type { ActionLog } from '../api/types'
import ErrorCard from '../components/ErrorCard'
import Modal from '../components/Modal'

export default function JournalScreen() {
  const [actions, setActions] = useState<ActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [cropFilter, setCropFilter] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ActionGroup | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    api
      .getAllActions()
      .then(setActions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // Список культур для фильтра — только из видимых (ручных) действий, чтобы не было
  // «пустых» чипов по культурам, у которых все записи авто (зеркало Android cropFilter).
  const crops = useMemo(() => {
    const set = new Set<string>()
    for (const a of actions) if (!a.auto && a.crop_name) set.add(a.crop_name)
    return [...set].sort((x, y) => x.localeCompare(y, 'ru'))
  }, [actions])

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

  const doDelete = async () => {
    if (!confirm) return
    setDeleting(true)
    // Свёрнутая серия = несколько записей; удаляем все её id. Promise.all уронил бы весь
    // батч при первой ошибке (уже удалённые на сервере записи остались бы в UI без следа) —
    // allSettled убирает из списка только реально удалённые и явно сообщает про остальные.
    const results = await Promise.allSettled(confirm.ids.map((id) => api.deleteAction(id)))
    const deletedIds = confirm.ids.filter((_, i) => results[i].status === 'fulfilled')
    const failedCount = results.length - deletedIds.length
    setActions((prev) => prev.filter((a) => !deletedIds.includes(a.id)))
    if (failedCount > 0) {
      const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
      const reason = firstError?.reason
      setError(
        deletedIds.length > 0
          ? `Удалено ${deletedIds.length} из ${confirm.ids.length}. Часть записей удалить не удалось — попробуйте ещё раз.`
          : reason instanceof ApiError ? reason.message : 'Не удалось удалить запись'
      )
    }
    setConfirm(null)
    setDeleting(false)
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>

  const filtered = actions.filter((a) => !a.auto && (cropFilter == null || a.crop_name === cropFilter))
  const groups = collapseActions(filtered)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Журнал действий</h1>
        {actions.length > 0 && (
          <button className="dacha-btn h-10 px-4" aria-label="Экспортировать журнал в CSV" disabled={exporting} onClick={exportCsv}>
            {exporting ? '…' : '⤓ CSV'}
          </button>
        )}
      </div>

      {crops.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={cropFilter == null} onClick={() => setCropFilter(null)}>
            Все культуры
          </FilterChip>
          {crops.map((c) => (
            <FilterChip key={c} active={cropFilter === c} onClick={() => setCropFilter(c)}>
              {c}
            </FilterChip>
          ))}
        </div>
      )}

      {error && <ErrorCard message={error} />}

      {groups.length === 0 && !error ? (
        <div className="dacha-card p-6 text-center font-semibold text-muted">
          {cropFilter ? 'Нет действий по этой культуре' : 'Действий пока нет'}
        </div>
      ) : (
        groups.map((g) => {
          const Icon = actionIcon(g.action_type)
          return (
            <div key={g.id} className="dacha-card flex items-center gap-3 p-4">
              <Icon size={20} className="shrink-0 text-primary" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">
                  {actionLabel(g.action_type)}
                  {g.crop_name ? ` · ${g.crop_name}` : ''}
                  {g.count > 1 ? ` ×${g.count}` : ''}
                </span>
                {g.note && <span className="text-sm font-semibold text-muted">{g.note}</span>}
              </div>
              <span className="shrink-0 text-sm font-semibold text-muted">
                {g.count > 1 ? `${formatDate(g.firstAt)}–${formatDate(g.lastAt)}` : formatDate(g.lastAt)}
              </span>
              <button
                onClick={() => setConfirm(g)}
                aria-label="Удалить запись"
                title="Удалить запись"
                className="shrink-0 rounded-btn p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          )
        })
      )}

      {confirm && (
        <Modal onClose={() => !deleting && setConfirm(null)} className="flex w-full max-w-sm flex-col gap-4 p-5">
            <h2 className="text-lg font-black">Удалить запись?</h2>
            <p className="font-semibold text-muted">
              «{actionLabel(confirm.action_type)}
              {confirm.crop_name ? ` — ${confirm.crop_name}` : ''}
              {confirm.count > 1 ? ` ×${confirm.count}` : ''}» будет удалено без возможности восстановления.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="h-10 rounded-btn px-4 font-bold text-muted transition hover:bg-background disabled:opacity-50"
                disabled={deleting}
                onClick={() => setConfirm(null)}
              >
                Отмена
              </button>
              <button
                className="dacha-btn h-10 bg-red-600 px-4 hover:bg-red-700"
                disabled={deleting}
                onClick={doDelete}
              >
                {deleting ? '…' : 'Удалить'}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`dacha-chip ${active ? 'dacha-chip-active' : ''}`}>
      {children}
    </button>
  )
}
