import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, ArrowLeft } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { STAGE_LABELS, actionLabel, formatDate } from '../api/labels'
import { buildSchedule, collapseActions, type SchedStatus } from '../api/schedule'
import { CareSection, NeighborsSection } from '../components/CropCare'
import ProblemList from '../components/ProblemList'
import ActionLogSheet from '../components/ActionLogSheet'
import PhotoDiary from '../components/PhotoDiary'
import type { ActionLog, Crop, GuideEntry, Planting } from '../api/types'

type Tab = 'planting' | 'care' | 'disease' | 'pest' | 'neighbors'
const TABS: { key: Tab; label: string }[] = [
  { key: 'planting', label: 'О посадке' },
  { key: 'care', label: 'Уход' },
  { key: 'disease', label: 'Болезни' },
  { key: 'pest', label: 'Вредители' },
  { key: 'neighbors', label: 'Соседи' },
]

export default function PlantingDetailScreen() {
  const { id } = useParams()
  const plantingId = Number(id)
  const navigate = useNavigate()

  const [planting, setPlanting] = useState<Planting | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [actions, setActions] = useState<ActionLog[]>([])
  const [problems, setProblems] = useState<GuideEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [tab, setTab] = useState<Tab>('planting')
  // Бамп при записи действия — чтобы лента дневника перечитала фото, прикреплённые к действию.
  const [photoRefresh, setPhotoRefresh] = useState(0)

  const load = async () => {
    try {
      const [p, a] = await Promise.all([api.getPlanting(plantingId), api.getActions(plantingId)])
      setPlanting(p)
      setActions(a)
      const c = await api.getCrop(p.crop_id).catch(() => null)
      setCrop(c)
      api.getGuide({ crop_id: p.crop_id }).then(setProblems).catch(() => setProblems([]))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадку')
    } finally {
      setLoading(false)
    }
  }

  const schedule = useMemo(() => {
    if (!planting?.planted_at || !crop) return []
    return buildSchedule({
      transplantDays: crop.transplant_days,
      careTasks: crop.care_tasks,
      harvestDays: crop.harvest_days,
      wateringFreqDays: crop.watering_freq_days,
      conditions: planting.conditions,
      sowingMethod: planting.sowing_method,
      planted: new Date(planting.planted_at),
      actions,
      today: new Date(),
    })
  }, [planting, crop, actions])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantingId])

  const remove = async () => {
    if (!confirm('Удалить посадку?')) return
    try {
      await api.deletePlanting(plantingId)
      navigate('/plantings', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!planting) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  const expectedYield =
    planting.yield_per_plant_kg && planting.quantity
      ? Math.round(planting.yield_per_plant_kg * planting.quantity * 10) / 10
      : null

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-left font-bold text-muted">
        <ArrowLeft size={18} aria-hidden /> Назад
      </button>

      <div className="dacha-card flex flex-col gap-1 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">{planting.crop_name ?? `Посадка #${planting.id}`}</h1>
          <span className="dacha-chip bg-background text-xs text-tertiary">
            {STAGE_LABELS[planting.stage] ?? planting.stage}
          </span>
        </div>
        {planting.variety && <p className="font-bold text-tertiary">Сорт: {planting.variety}</p>}
        <p className="font-semibold text-muted">
          Посажено {formatDate(planting.planted_at)} · {planting.quantity ?? 1} шт.
          {planting.conditions === 'greenhouse' ? ' · теплица' : ''}
        </p>
        {expectedYield != null && (
          <p className="font-semibold text-tertiary">Ожидаемый урожай ~{expectedYield} кг</p>
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

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {tab === 'planting' && (
        <>
          <button className="dacha-btn flex items-center justify-center gap-2" onClick={() => setLogging(true)}>
            <Pencil size={18} aria-hidden /> Записать действие
          </button>

          {schedule.length > 0 && (
            <section className="dacha-card flex flex-col gap-1.5 p-5">
              <h2 className="text-lg font-black">Расписание работ</h2>
              <p className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1"><Dot status="done" /> выполнено</span>
                <span className="flex items-center gap-1"><Dot status="missed" /> просрочено</span>
                <span className="flex items-center gap-1"><Dot status="upcoming" /> предстоит</span>
              </p>
              {schedule.map((row, i) => (
                <SchedRowView key={i} row={row} />
              ))}
            </section>
          )}

          <PhotoDiary key={photoRefresh} plantingId={planting.id} />

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-black">История действий</h2>
            {actions.length === 0 ? (
              <div className="dacha-card p-4 font-semibold text-muted">Действий пока нет</div>
            ) : (
              collapseActions(actions).map((g) => (
                <div key={g.id} className="dacha-card flex items-center justify-between p-4">
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {actionLabel(g.action_type)}
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
          </section>

          <button onClick={remove} className="mt-2 font-bold text-red-600">
            Удалить посадку
          </button>
        </>
      )}

      {tab === 'care' && (crop ? <CareSection crop={crop} /> : <p className="dacha-card p-4 font-semibold text-muted">Нет данных об уходе.</p>)}
      {tab === 'disease' && (
        <ProblemList entries={problems} kind="disease" cropId={planting.crop_id} cropName={planting.crop_name} emptyText="Болезни не отмечены." />
      )}
      {tab === 'pest' && (
        <ProblemList entries={problems} kind="pest" cropId={planting.crop_id} cropName={planting.crop_name} emptyText="Вредители не отмечены." />
      )}
      {tab === 'neighbors' && (crop ? <NeighborsSection crop={crop} /> : <p className="dacha-card p-4 font-semibold text-muted">Нет данных.</p>)}

      {logging && (
        <ActionLogSheet
          plantingId={plantingId}
          cropName={planting.crop_name}
          onClose={() => setLogging(false)}
          onLogged={() => {
            setLogging(false)
            setPhotoRefresh((n) => n + 1)
            load()
          }}
        />
      )}
    </div>
  )
}

const DOT_COLOR: Record<SchedStatus, string> = {
  done: 'bg-tertiary',
  missed: 'bg-red-500',
  upcoming: 'bg-black/25',
  neutral: 'bg-transparent',
}

// Цветная точка статуса вместо эмодзи 🟢🔴⚪
function Dot({ status }: { status: SchedStatus }) {
  if (status === 'neutral') return null
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[status]}`} />
}

function SchedRowView({ row }: { row: import('../api/schedule').SchedRow }) {
  const color =
    row.status === 'missed'
      ? 'text-red-600'
      : row.status === 'upcoming'
        ? 'text-[#3a2a1a]'
        : 'text-muted'
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/5 py-1.5 last:border-0">
      <div className="flex flex-col">
        <span className={`flex items-center gap-1.5 font-semibold ${color} ${row.status === 'done' ? 'line-through' : ''}`}>
          <Dot status={row.status} />
          {row.name}
        </span>
        {row.product && <span className="text-xs font-semibold text-tertiary">Препарат: {row.product}</span>}
      </div>
      <span className={`shrink-0 font-semibold ${color} ${row.status === 'missed' ? 'font-black' : ''}`}>
        {row.dateStr}
      </span>
    </div>
  )
}
