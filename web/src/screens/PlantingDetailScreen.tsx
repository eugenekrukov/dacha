import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Pencil, ArrowLeft, Lock } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { STAGE_LABELS, actionLabel, formatDate } from '../api/labels'
import { buildSchedule, careTaskActionType, collapseActions, type SchedStatus } from '../api/schedule'
import { useGardens } from '../garden/GardenContext'
import { CareSection, NeighborsSection } from '../components/CropCare'
import ProblemList from '../components/ProblemList'
import DiagnosePhotoButton from '../components/DiagnosePhotoButton'
import ActionLogSheet from '../components/ActionLogSheet'
import PhotoDiary from '../components/PhotoDiary'
import BedField from '../components/BedField'
import type { ActionLog, Crop, GardenBed, GuideEntry, Planting } from '../api/types'

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
  const { gardens } = useGardens()

  const [planting, setPlanting] = useState<Planting | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [actions, setActions] = useState<ActionLog[]>([])
  const [problems, setProblems] = useState<GuideEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  // Тип действия, с которым открыть лист — клик по строке расписания (см. openForRow)
  const [preselectType, setPreselectType] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('planting')
  // Бамп при записи действия — чтобы лента дневника перечитала фото, прикреплённые к действию.
  const [photoRefresh, setPhotoRefresh] = useState(0)
  const [beds, setBeds] = useState<GardenBed[]>([])
  const [editingBed, setEditingBed] = useState(false)

  const load = async () => {
    try {
      const [p, a] = await Promise.all([api.getPlanting(plantingId), api.getActions(plantingId)])
      setPlanting(p)
      setActions(a)
      const c = await api.getCrop(p.crop_id).catch(() => null)
      setCrop(c)
      api.getGuide({ crop_id: p.crop_id }).then(setProblems).catch(() => setProblems([]))
      api.getBeds(p.garden_id).then(setBeds).catch(() => setBeds([]))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадку')
    } finally {
      setLoading(false)
    }
  }

  const schedule = useMemo(() => {
    if (!planting?.planted_at || !crop) return []
    // Начало сезона берём у участка ЭТОЙ посадки, а не у активного: участков может быть
    // несколько. Число уже посчитано сервером (см. normalizeGarden).
    const seasonStart = gardens.find((g) => g.id === planting.garden_id)?.season_start_doy ?? null
    return buildSchedule({
      transplantDays: crop.transplant_days,
      careTasks: crop.care_tasks,
      harvestDays: crop.harvest_days,
      wateringFreqDays: crop.watering_freq_days,
      conditions: planting.conditions,
      sowingMethod: planting.sowing_method,
      isPerennial: crop.is_perennial,
      seasonStart,
      seasonEnd: gardens.find((g) => g.id === planting.garden_id)?.season_end_doy ?? null,
      planted: new Date(planting.planted_at),
      actions,
      today: new Date(),
      createdAt: planting.created_at ? new Date(planting.created_at) : null,
    })
  }, [planting, crop, actions, gardens])

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

  const finishSeason = async () => {
    if (!planting) return
    if (!confirm(`«${planting.crop_name ?? 'Посадка'}» будет переведена в архив. Данные сохранятся.`)) return
    try {
      const updated = await api.updateStage(plantingId, 'done')
      setPlanting(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить сезон')
    }
  }

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!planting) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  const expectedYield =
    planting.yield_per_plant_kg && planting.quantity
      ? Math.round(planting.yield_per_plant_kg * planting.quantity * 10) / 10
      : null

  // Посадка сверх free-набора без подписки: правки закрыты, но завершить сезон и удалить
  // можно всегда — это разрешает и бэкенд (isPlantingLocked), иначе выйти из лимита было бы нечем.
  const locked = planting.locked === true

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
        </p>
        {locked && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-muted">
            <Lock size={14} aria-hidden className="shrink-0" />
            Только чтение: бесплатно ведутся 3 посадки.
            <Link to="/paywall" className="font-bold text-link underline">
              Оформить подписку →
            </Link>
          </p>
        )}
        {locked ? (
          <p className="font-semibold text-muted">
            Место: {beds.find((b) => b.id === planting.bed_id)?.name ?? 'не выбрано'}
          </p>
        ) : editingBed ? (
          <BedField
            gardenId={planting.garden_id}
            value={planting.bed_id ?? null}
            cropFamily={crop?.family}
            cropSpacingInRowCm={crop?.spacing_in_row_cm}
            cropSpacingBetweenRowsCm={crop?.spacing_between_rows_cm}
            excludePlantingId={planting.id}
            onSelect={async (bed) => {
              setEditingBed(false)
              try {
                const updated = await api.updatePlantingInfo(planting.id, { bed_id: bed?.id ?? undefined })
                setPlanting(updated)
                if (bed) {
                  setBeds((prev) =>
                    prev.some((b) => b.id === bed.id) ? prev.map((b) => (b.id === bed.id ? bed : b)) : [...prev, bed],
                  )
                }
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Не удалось обновить место')
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-left font-semibold text-muted"
            onClick={() => setEditingBed(true)}
          >
            <Pencil size={14} aria-hidden />
            Место: {beds.find((b) => b.id === planting.bed_id)?.name ?? 'не выбрано'}
          </button>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold text-muted">Условия:</span>
          {(['soil', 'greenhouse'] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={locked}
              className={`dacha-chip text-xs ${planting.conditions === c ? 'dacha-chip-active' : ''} ${locked ? 'opacity-50' : ''}`}
              onClick={async () => {
                if (planting.conditions === c) return
                try {
                  const updated = await api.updatePlantingInfo(planting.id, { conditions: c })
                  setPlanting(updated)
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Не удалось обновить условия')
                }
              }}
            >
              {c === 'soil' ? 'Грунт' : 'Теплица'}
            </button>
          ))}
        </div>
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
          {!locked && (
            <button
              className="dacha-btn flex items-center justify-center gap-2"
              onClick={() => { setPreselectType(null); setLogging(true) }}
            >
              <Pencil size={18} aria-hidden /> Записать действие
            </button>
          )}

          {schedule.length > 0 && (
            <section className="dacha-card flex flex-col gap-1.5 p-5">
              <h2 className="text-lg font-black">Расписание работ</h2>
              <p className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1"><Dot status="done" /> выполнено</span>
                <span className="flex items-center gap-1"><Dot status="missed" /> просрочено</span>
                <span className="flex items-center gap-1"><Dot status="upcoming" /> предстоит</span>
              </p>
              {schedule.map((row, i) => (
                <SchedRowView
                  key={i}
                  row={row}
                  disabled={locked}
                  onClick={() => {
                    // Пересадка/полив — отдельные типы; остальные строки — по имени care-задачи
                    // (substring-match, переживает суффикс «(каждые N дн.)»); неизвестное → 'other'.
                    const n = row.name.toLowerCase()
                    const type = n.includes('пересадк')
                      ? 'transplanting'
                      : n.includes('полив')
                        ? 'watering'
                        : (careTaskActionType(row.name) ?? 'other')
                    setPreselectType(type)
                    setLogging(true)
                  }}
                />
              ))}
            </section>
          )}

          <PhotoDiary key={photoRefresh} plantingId={planting.id} locked={locked} />

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

          {planting.stage !== 'done' && (
            <button onClick={finishSeason} className="mt-2 font-bold text-tertiary">
              Завершить сезон
            </button>
          )}
          <button onClick={remove} className="mt-2 font-bold text-red-600">
            Удалить посадку
          </button>
        </>
      )}

      {tab === 'care' && (crop ? <CareSection crop={crop} /> : <p className="dacha-card p-4 font-semibold text-muted">Нет данных об уходе.</p>)}
      {tab === 'disease' && (
        <>
          <DiagnosePhotoButton plantingId={planting.id} locked={locked} />
          <ProblemList entries={problems} kind="disease" cropId={planting.crop_id} cropName={planting.crop_name} emptyText="Болезни не отмечены." />
        </>
      )}
      {tab === 'pest' && (
        <>
          <DiagnosePhotoButton plantingId={planting.id} locked={locked} />
          <ProblemList entries={problems} kind="pest" cropId={planting.crop_id} cropName={planting.crop_name} emptyText="Вредители не отмечены." />
        </>
      )}
      {tab === 'neighbors' && (crop ? <NeighborsSection crop={crop} /> : <p className="dacha-card p-4 font-semibold text-muted">Нет данных.</p>)}

      {logging && (
        <ActionLogSheet
          plantingId={plantingId}
          cropName={planting.crop_name}
          preselectedType={preselectType}
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

function SchedRowView({
  row,
  onClick,
  disabled,
}: {
  row: import('../api/schedule').SchedRow
  onClick?: () => void
  disabled?: boolean
}) {
  const color =
    row.status === 'missed'
      ? 'text-red-600'
      : row.status === 'upcoming'
        ? 'text-[#3a2a1a]'
        : 'text-muted'
  // «Сбор урожая» (neutral) не связан с action_type — кликом не открываем лист.
  const clickable = row.status !== 'neutral' && !disabled
  const content = (
    <>
      <div className="flex flex-col">
        <span className={`flex items-center gap-1.5 font-semibold ${color} ${row.status === 'done' ? 'line-through' : ''}`}>
          <Dot status={row.status} />
          {row.name}
        </span>
        {row.product && <span className="text-xs font-semibold text-tertiary">Препарат: {row.product}</span>}
        {/* Клик по строке подставляет тип в лист действия — просроченное неочевидно кликабельно без подсказки */}
        {clickable && row.status === 'missed' && (
          <span className="text-xs font-semibold text-red-600/70">Нажмите, чтобы отметить выполненным</span>
        )}
      </div>
      <span className={`shrink-0 font-semibold ${color} ${row.status === 'missed' ? 'font-black' : ''}`}>
        {row.dateStr}
      </span>
    </>
  )
  const className = 'flex w-full items-start justify-between gap-3 border-b border-black/5 py-1.5 text-left last:border-0'
  return clickable ? (
    <button type="button" onClick={onClick} className={`${className} active:opacity-70`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
