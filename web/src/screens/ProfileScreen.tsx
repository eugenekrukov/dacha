import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Sprout,
  Trophy,
  Flag,
  X,
  Trash2,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useGardens } from '../garden/GardenContext'
import AuthImage from '../components/AuthImage'
import EntryCard from '../components/EntryCard'
import type { FeedItem, MilestoneKind } from '../api/types'

type Tab = 'feed' | 'stats' | 'guide'

export default function ProfileScreen() {
  const { active } = useGardens()
  const [tab, setTab] = useState<Tab>('feed')

  const region = [active?.city, active?.region].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col">
        <h1 className="text-2xl font-black">{active?.name?.trim() || 'Мой участок'}</h1>
        {region && <span className="text-sm font-semibold text-muted">{region}</span>}
      </header>

      <div className="flex gap-2">
        <TabChip active={tab === 'feed'} onClick={() => setTab('feed')}>Лента</TabChip>
        <TabChip active={tab === 'stats'} onClick={() => setTab('stats')}>Статистика</TabChip>
        <TabChip active={tab === 'guide'} onClick={() => setTab('guide')}>Справочник</TabChip>
      </div>

      {tab === 'feed' && <FeedList />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'guide' && <GuideTab />}
    </div>
  )
}

function TabChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`dacha-chip ${active ? 'dacha-chip-active' : ''}`}>
      {children}
    </button>
  )
}

// --- Лента ---

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const idx = Number(m) - 1
  return `${MONTHS[idx] ?? m} ${y}`
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const LIMIT = 30

function FeedList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<ViewerTarget | null>(null)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const loadPage = useCallback(async (offset: number) => {
    const res = await api.getFeed(LIMIT, offset)
    setItems((prev) => (offset === 0 ? res.items : [...prev, ...res.items]))
    setNextOffset(res.next_offset)
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    loadPage(0)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Не удалось загрузить ленту'))
      .finally(() => setLoading(false))
  }, [loadPage])

  useEffect(() => {
    reload()
  }, [reload])

  // Бесконечная подгрузка: наблюдаем за «сторожем» в конце списка.
  useEffect(() => {
    if (nextOffset == null || loading) return
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore) {
        setLoadingMore(true)
        loadPage(nextOffset)
          .catch(() => { /* мягко игнорируем — следующий скролл повторит */ })
          .finally(() => setLoadingMore(false))
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [nextOffset, loading, loadingMore, loadPage])

  const removePhoto = async (photoId: number) => {
    await api.deletePhoto(photoId)
    setViewer(null)
    reload()
  }
  const removeRecord = async (actionId: number) => {
    await api.deleteAction(actionId)
    setViewer(null)
    reload()
  }
  const replacePhoto = async (t: ViewerTarget, file: File) => {
    if (t.plantingId == null) return
    await api.deletePhoto(t.photoId)
    await api.uploadPhoto(t.plantingId, file, { actionId: t.actionId ?? undefined })
    setViewer(null)
    reload()
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (error) return <div className="dacha-card p-4 font-semibold text-muted">{error}</div>
  if (items.length === 0)
    return (
      <div className="dacha-card p-6 text-center font-semibold text-muted">
        Лента пуста. Снимайте посадки и отмечайте действия — соберётся история роста.
      </div>
    )

  // items уже отсортированы по дате убыв. на бэкенде → группировка по месяцу сохраняет порядок.
  const groups: { month: string; rows: FeedItem[] }[] = []
  for (const it of items) {
    const key = it.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === key) last.rows.push(it)
    else groups.push({ month: key, rows: [it] })
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <div key={g.month} className="flex flex-col gap-2">
          <h2 className="mt-2 px-1 text-sm font-black uppercase tracking-wide text-muted">{monthLabel(g.month)}</h2>
          {g.rows.map((it) => (
            <FeedRow key={`${it.type}_${it.action_id ?? it.photo_id ?? it.kind}_${it.planting_id}_${it.date}`}
              item={it}
              onOpenPlanting={(id) => navigate(`/plantings/${id}`)}
              onOpenPhoto={(t) => setViewer(t)}
            />
          ))}
        </div>
      ))}

      <div ref={sentinel} />
      {loadingMore && <p className="p-2 text-center text-sm font-semibold text-muted">Загрузка…</p>}

      {viewer && (
        <PhotoViewer
          target={viewer}
          onClose={() => setViewer(null)}
          onDeletePhoto={() => removePhoto(viewer.photoId)}
          onDeleteRecord={viewer.actionId != null ? () => removeRecord(viewer.actionId!) : undefined}
          onReplace={(file) => replacePhoto(viewer, file)}
        />
      )}
    </div>
  )
}

function FeedRow({
  item,
  onOpenPlanting,
  onOpenPhoto,
}: {
  item: FeedItem
  onOpenPlanting: (id: number) => void
  onOpenPhoto: (t: ViewerTarget) => void
}) {
  if (item.type === 'action') {
    return (
      <EntryCard
        actionType={item.action_type ?? 'other'}
        note={item.note}
        dateLabel={shortDate(item.date)}
        cropName={item.crop_name}
        photos={item.photos ?? []}
        onOpenPhoto={(ph) =>
          onOpenPhoto({
            photoId: ph.photo_id,
            url: ph.url,
            actionId: item.action_id ?? null,
            plantingId: item.planting_id ?? null,
            cropName: item.crop_name ?? null,
            dateIso: item.date,
            caption: item.note ?? null,
          })
        }
      />
    )
  }

  if (item.type === 'photo') {
    return (
      <button
        type="button"
        onClick={() =>
          item.photo_id != null &&
          onOpenPhoto({
            photoId: item.photo_id,
            url: item.url ?? '',
            actionId: null,
            plantingId: item.planting_id ?? null,
            cropName: item.crop_name ?? null,
            dateIso: item.date,
            caption: item.caption ?? null,
          })
        }
        className="dacha-card flex items-center gap-3 p-3 text-left"
      >
        {item.thumb_url && (
          <AuthImage path={item.thumb_url} alt="Фото" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="font-bold">{item.crop_name ?? 'Фото'}</span>
          {item.caption && <span className="text-sm font-semibold text-muted">{item.caption}</span>}
          <span className="text-xs font-semibold text-muted">{shortDate(item.date)}</span>
        </div>
      </button>
    )
  }

  // milestone
  return (
    <MilestoneRow
      kind={item.kind ?? 'sowing'}
      cropName={item.crop_name}
      weightKg={item.weight_kg}
      dateLabel={shortDate(item.date)}
      onOpen={() => item.planting_id != null && onOpenPlanting(item.planting_id)}
    />
  )
}

const MILESTONE: Record<MilestoneKind, { icon: LucideIcon; label: (crop?: string | null) => string }> = {
  sowing: { icon: Sprout, label: (c) => `Посеяно${c ? `: ${c}` : ''}` },
  first_harvest: { icon: Trophy, label: (c) => `Первый урожай${c ? `: ${c}` : ''}` },
  done: { icon: Flag, label: (c) => `Сезон завершён${c ? `: ${c}` : ''}` },
}

function MilestoneRow({
  kind,
  cropName,
  weightKg,
  dateLabel,
  onOpen,
}: {
  kind: MilestoneKind
  cropName?: string | null
  weightKg?: number | null
  dateLabel: string
  onOpen: () => void
}) {
  const m = MILESTONE[kind]
  const Icon = m.icon
  return (
    <button onClick={onOpen} className="flex items-center gap-3 rounded-card border border-dashed border-primary/40 bg-primary/5 p-3 text-left">
      <Icon size={20} className="shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="font-bold">
          {m.label(cropName)}
          {kind === 'first_harvest' && weightKg != null ? ` · ${weightKg} кг` : ''}
        </span>
        <span className="text-xs font-semibold text-muted">{dateLabel}</span>
      </div>
    </button>
  )
}

// --- Полноэкранный просмотр фото с действиями (замена/удаление/удаление записи) ---

interface ViewerTarget {
  photoId: number
  url: string
  actionId: number | null
  plantingId: number | null
  cropName: string | null
  dateIso: string
  caption: string | null
}

function PhotoViewer({
  target,
  onClose,
  onDeletePhoto,
  onDeleteRecord,
  onReplace,
}: {
  target: ViewerTarget
  onClose: () => void
  onDeletePhoto: () => void
  onDeleteRecord?: () => void
  onReplace: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const wrap = (fn: () => void | Promise<void>) => async () => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) wrap(() => onReplace(f))()
            }}
          />
          <IconBtn label="Заменить фото" onClick={() => fileRef.current?.click()} disabled={busy}>
            <RefreshCw size={20} />
          </IconBtn>
          <IconBtn label="Удалить фото" onClick={wrap(onDeletePhoto)} disabled={busy}>
            <Trash2 size={20} />
          </IconBtn>
          {onDeleteRecord && (
            <button
              onClick={wrap(onDeleteRecord)}
              disabled={busy}
              className="rounded-btn px-3 py-2 text-sm font-bold text-white/90 hover:bg-white/10 disabled:opacity-50"
            >
              Удалить запись
            </button>
          )}
        </div>
        <IconBtn label="Закрыть" onClick={onClose} disabled={busy}>
          <X size={22} />
        </IconBtn>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <AuthImage path={target.url} alt="Фото посадки" className="max-h-full max-w-full object-contain" />
      </div>

      <div className="flex flex-col gap-0.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {target.cropName && <span className="text-lg font-black text-white">{target.cropName}</span>}
        <span className="text-sm font-semibold text-white/70">{shortDate(target.dateIso)}</span>
        {target.caption && <span className="text-sm text-white/90">{target.caption}</span>}
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-btn p-2 text-white/90 hover:bg-white/10 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// --- Вкладки Статистика / Справочник: хаб-ссылки (зеркало Android HubTab) ---

function HubCard({ icon: Icon, title, subtitle, to }: { icon: LucideIcon; title: string; subtitle: string; to: string }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(to)} className="dacha-card flex items-center gap-3 p-4 text-left">
      <Icon size={24} className="shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-black">{title}</span>
        <span className="text-xs font-semibold text-muted">{subtitle}</span>
      </div>
      <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
    </button>
  )
}

function StatsTab() {
  return (
    <div className="flex flex-col gap-3">
      <HubCard icon={BarChart3} title="Статистика и урожай" subtitle="Серия дней, активность, сборы, экспорт CSV" to="/harvests" />
      <HubCard icon={BookOpen} title="Журнал действий" subtitle="История действий с заметками и фото" to="/journal" />
    </div>
  )
}

function GuideTab() {
  return (
    <div className="flex flex-col gap-3">
      <HubCard icon={BookOpen} title="Справочник культур" subtitle="Сроки, полив, болезни, соседство" to="/crops" />
      <HubCard icon={ShieldAlert} title="Болезни и дефициты" subtitle="Дефициты микроэлементов, болезни, вредители" to="/guide" />
    </div>
  )
}
