import { actionLabel } from '../api/labels'
import { actionIcon } from '../ui/icons'
import AuthImage from './AuthImage'
import type { FeedPhoto } from '../api/types'

// Единый блок «действие + заметка + фото» — общая карточка для ленты «Мой участок»
// и журнала действий (зеркало Android ActionFeedCard). Если фото нет — обычная строка
// действия; если есть — снизу ряд миниатюр.
export default function EntryCard({
  actionType,
  note,
  dateLabel,
  cropName,
  photos = [],
  onOpenPhoto,
}: {
  actionType: string
  note?: string | null
  dateLabel: string
  cropName?: string | null
  photos?: FeedPhoto[]
  onOpenPhoto?: (photo: FeedPhoto) => void
}) {
  const Icon = actionIcon(actionType)
  return (
    <div className="dacha-card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col">
            <span className="font-bold">
              {actionLabel(actionType)}
              {cropName ? ` · ${cropName}` : ''}
            </span>
            {note && <span className="text-sm font-semibold text-muted">{note}</span>}
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-muted">{dateLabel}</span>
      </div>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-[30px]">
          {photos.map((ph) => (
            <button
              key={ph.photo_id}
              type="button"
              onClick={() => onOpenPhoto?.(ph)}
              className="overflow-hidden rounded-xl border border-black/10"
            >
              <AuthImage path={ph.thumb_url} alt="Фото действия" className="h-20 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
