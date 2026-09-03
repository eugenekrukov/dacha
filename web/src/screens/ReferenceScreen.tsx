import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import ErrorCard from '../components/ErrorCard'
import CropList from '../components/CropList'
import GuideList from '../components/GuideList'
import ArticleList from '../components/ArticleList'
import type { Crop, GuideEntry, BlogPost } from '../api/types'

// «Справочник»: всё общее в одном месте (см. spec §3/§5) — культуры, болезни/вредители,
// статьи блога. Три списка грузятся целиком (кроме статей — постранично), поиск клиентский.
type Tab = 'all' | 'crops' | 'guide' | 'articles'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'crops', label: 'Культуры' },
  { key: 'guide', label: 'Болезни' },
  { key: 'articles', label: 'Статьи' },
]
const ARTICLES_PAGE = 20

export default function ReferenceScreen() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'all'
  const [query, setQuery] = useState('')

  const [crops, setCrops] = useState<Crop[]>([])
  const [guideEntries, setGuideEntries] = useState<GuideEntry[]>([])
  const [articles, setArticles] = useState<BlogPost[]>([])
  const [articlesTotal, setArticlesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.getCrops(),
      api.getGuide(),
      // Фид блога может быть недоступен (бэкенд ещё не задеплоен/сеть) — не роняем весь
      // экран ради статей, культуры и болезни важнее (см. TodayScreen — тот же приём).
      api.getBlogFeed(ARTICLES_PAGE, 0).catch(() => ({ items: [], total: 0 })),
    ])
      .then(([c, g, feed]) => {
        setCrops(c)
        setGuideEntries(g)
        setArticles(feed.items)
        setArticlesTotal(feed.total)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить справочник'))
      .finally(() => setLoading(false))
  }, [])

  const loadMoreArticles = () => {
    setLoadingMore(true)
    api
      .getBlogFeed(ARTICLES_PAGE, articles.length)
      .then((feed) => setArticles((prev) => [...prev, ...feed.items]))
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const setTab = (t: Tab) => setParams(t === 'all' ? {} : { tab: t }, { replace: true })

  const q = query.trim().toLowerCase()
  // Клиентский поиск по подстроке в названии/заголовке — три списка и так грузятся целиком
  // (кроме статей — только уже подгруженная страница, см. spec §4).
  const matchedCrops = useMemo(() => (q ? crops.filter((c) => c.name.toLowerCase().includes(q)) : crops), [crops, q])
  const matchedGuide = useMemo(
    () => (q ? guideEntries.filter((e) => e.name.toLowerCase().includes(q)) : guideEntries),
    [guideEntries, q],
  )
  const matchedArticles = useMemo(
    () => (q ? articles.filter((a) => a.title.toLowerCase().includes(q)) : articles),
    [articles, q],
  )

  // Пустой запрос → только активный сегмент («Все» → статьи, свежее содержимое раздела).
  // Непустой запрос → все три корпуса сразу, сегмент фильтрует группу.
  const showCrops = q ? tab === 'all' || tab === 'crops' : tab === 'crops'
  const showGuide = q ? tab === 'all' || tab === 'guide' : tab === 'guide'
  const showArticles = q ? tab === 'all' || tab === 'articles' : tab === 'all' || tab === 'articles'

  const nothingFound = q !== '' && matchedCrops.length === 0 && matchedGuide.length === 0 && matchedArticles.length === 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Справочник</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: культура, болезнь, статья…"
          className="dacha-card w-full rounded-2xl py-3 pl-11 pr-10 font-semibold outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button
            aria-label="Очистить"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`dacha-chip ${tab === t.key ? 'dacha-chip-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'guide' && (
        <p className="text-sm text-muted">
          Определить болезнь или вредителя по фото можно в карточке своей посадки — на вкладке
          «Болезни» или «Вредители».
        </p>
      )}

      {error && <ErrorCard message={error} />}

      {loading ? (
        <p className="p-4 font-bold text-muted">Загрузка…</p>
      ) : nothingFound ? (
        <div className="dacha-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-3xl">🔍</span>
          <p className="font-semibold text-muted">Ничего не найдено по «{query.trim()}»</p>
        </div>
      ) : (
        <>
          {showGuide && matchedGuide.length > 0 && (
            <Section title={q ? 'Болезни и вредители' : undefined}>
              <GuideList entries={matchedGuide} />
            </Section>
          )}
          {showCrops && matchedCrops.length > 0 && (
            <Section title={q ? 'Культуры' : undefined}>
              <CropList crops={matchedCrops} />
            </Section>
          )}
          {showArticles && matchedArticles.length > 0 && (
            <Section title={q ? 'Статьи' : undefined}>
              <ArticleList
                articles={matchedArticles}
                hasMore={!q && articles.length < articlesTotal}
                onLoadMore={loadMoreArticles}
                loadingMore={loadingMore}
              />
            </Section>
          )}
          {/* Браузинг (без поиска), фида нет/пуст — заглушка вместо пустоты (см. spec §8). */}
          {showArticles && matchedArticles.length === 0 && !q && (
            <p className="dacha-card p-4 font-semibold text-muted">Статей пока нет.</p>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  if (!title) return <>{children}</>
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-black">{title}</h2>
      {children}
    </div>
  )
}
