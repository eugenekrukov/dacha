import type { BlogPost } from '../api/types'

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

// Карточка статьи блога → открывается на сайте (calendacha.ru), нативного рендера тела нет.
export default function ArticleList({
  articles,
  hasMore,
  onLoadMore,
  loadingMore,
}: {
  articles: BlogPost[]
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
}) {
  if (articles.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      {articles.map((a) => (
        <a
          key={a.slug}
          href={a.url}
          target="_blank"
          rel="noopener"
          className="dacha-card-link flex gap-3 p-3"
        >
          {a.image ? (
            <img
              src={a.image}
              alt={a.title}
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-btn object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-btn bg-primary/10 text-2xl">
              🌱
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-black">{a.title}</span>
            <span className="text-xs font-semibold text-muted">{dateLabel(a.published_at)}</span>
            {a.lead && <span className="line-clamp-2 text-sm font-semibold text-muted">{a.lead}</span>}
          </div>
        </a>
      ))}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="dacha-chip mx-auto disabled:opacity-50"
        >
          {loadingMore ? 'Загрузка…' : 'Показать ещё'}
        </button>
      )}
    </div>
  )
}
