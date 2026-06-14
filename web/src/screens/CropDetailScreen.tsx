import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { categoryLabel } from '../api/labels'
import type { Crop, CropDisease, CropPest, FertilizingEntry, WateringDetails, WateringStage } from '../api/types'

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-3 border-b border-black/5 py-2 last:border-0">
      <span className="font-semibold text-muted">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  )
}

// Раскрываемая карточка болезни/вредителя (зеркало android DiseaseCard/PestCard).
function ExpandableCard({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-card border border-black/10 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left font-bold"
      >
        <span>{title}</span>
        <span className="text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="flex flex-col gap-2 px-4 pb-4">{children}</div>}
    </div>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-tertiary' : ''}`}>{value}</p>
    </div>
  )
}

const STAGE_LABELS: Record<keyof Omit<WateringDetails, 'notes'>, string> = {
  seedling: 'Рассада',
  sprouted: 'Всходы',
  growing: 'Рост',
  flowering: 'Цветение',
  fruiting: 'Плодоношение',
  harvesting: 'Уборка',
}

const FERT_STAGE_LABELS: Record<string, string> = {
  seedling: 'Рассада',
  sprouted: 'Всходы',
  growing: 'Рост',
  flowering: 'Цветение',
  fruiting: 'Плодоношение',
  harvesting: 'Уборка',
}

function wateringStageValue(w: WateringStage): string {
  const parts: string[] = []
  if (w.freq_days) parts.push(`каждые ${w.freq_days} дн.`)
  if (w.amount_l_m2) parts.push(`${w.amount_l_m2} л/м²`)
  return parts.join(' · ')
}

export default function CropDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [crop, setCrop] = useState<Crop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getCrop(Number(id))
      .then(setCrop)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить культуру'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-4 font-bold text-muted">Загрузка…</p>
  if (!crop) return <p className="p-4 font-bold text-muted">{error ?? 'Не найдено'}</p>

  const watering = crop.watering_details
  const wateringStages = watering
    ? (Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[])
        .map((key) => ({ key, label: STAGE_LABELS[key], stage: watering[key] }))
        .filter((s): s is { key: keyof typeof STAGE_LABELS; label: string; stage: WateringStage } => s.stage != null)
    : []
  const schedule = crop.fertilizing_schedule ?? []
  const diseases: CropDisease[] = crop.diseases ?? []
  const pests: CropPest[] = crop.pests ?? []

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="text-left font-bold text-muted">
        ← Назад
      </button>

      <div className="dacha-card flex flex-col gap-2 p-5">
        <h1 className="text-2xl font-black">{crop.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {crop.category && <span className="font-semibold text-muted">{categoryLabel(crop.category)}</span>}
          {crop.is_perennial && (
            <span className="rounded-full bg-tertiary/15 px-2.5 py-0.5 text-xs font-bold text-tertiary">
              🌿 Многолетник
            </span>
          )}
        </div>
      </div>

      <section className="dacha-card p-5">
        <h2 className="mb-2 text-lg font-black">Сроки и уход</h2>
        <Fact label="Высадка рассады" value={crop.transplant_days ? `через ${crop.transplant_days} дн.` : null} />
        <Fact label="До урожая" value={crop.harvest_days ? `${crop.harvest_days} дн.` : null} />
        <Fact label="Полив" value={crop.watering_freq_days ? `каждые ${crop.watering_freq_days} дн.` : null} />
        <Fact label="Чувствительна к заморозкам" value={crop.frost_sensitive ? 'да' : null} />
        <Fact label="Тип" value={crop.is_perennial ? 'многолетник' : 'однолетник'} />
        <Fact
          label="Урожай с растения"
          value={crop.yield_per_plant_kg ? `~${crop.yield_per_plant_kg} кг` : null}
        />
      </section>

      {wateringStages.length > 0 && (
        <section className="dacha-card p-5">
          <h2 className="mb-2 text-lg font-black">Полив по стадиям</h2>
          {wateringStages.map((s) => (
            <Fact key={s.key} label={s.label} value={wateringStageValue(s.stage)} />
          ))}
          {watering?.notes && <p className="mt-2 text-sm font-semibold text-muted">{watering.notes}</p>}
        </section>
      )}

      {schedule.length > 0 && (
        <section className="dacha-card p-5">
          <h2 className="mb-3 text-lg font-black">Схема подкормок</h2>
          <div className="flex flex-col gap-3">
            {schedule.map((e: FertilizingEntry, i) => (
              <div key={i} className="border-b border-black/5 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">
                    {e.stage ? (FERT_STAGE_LABELS[e.stage] ?? e.stage) : ''}
                  </span>
                  {e.method && (
                    <span className="text-xs font-semibold text-muted">
                      {e.method === 'foliar' ? 'внекорневая' : e.method === 'root' ? 'корневая' : e.method}
                    </span>
                  )}
                </div>
                {e.timing && <p className="text-sm font-semibold text-muted">{e.timing}</p>}
                {e.product_example && (
                  <p className="font-bold">🧪 {e.product_example}{e.dose ? ` — ${e.dose}` : ''}</p>
                )}
                {e.notes && <p className="text-sm font-semibold text-muted">{e.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(diseases.length > 0 || pests.length > 0) && (
        <section className="dacha-card p-5">
          <h2 className="mb-3 text-lg font-black">Болезни и вредители</h2>
          <div className="flex flex-col gap-2">
            {diseases.map((d, i) => (
              <ExpandableCard key={`d${i}`} title={`🦠 ${d.name}`}>
                <DetailRow label="Симптомы" value={d.symptoms} />
                <DetailRow label="Условия" value={d.conditions} />
                <DetailRow label="Лечение" value={d.treatment} highlight />
                <DetailRow label="Профилактика" value={d.prevention} />
              </ExpandableCard>
            ))}
            {pests.map((p, i) => (
              <ExpandableCard key={`p${i}`} title={`🐛 ${p.name}`}>
                <DetailRow label="Признаки" value={p.signs} />
                <DetailRow label="Борьба" value={p.treatment} highlight />
                <DetailRow label="Профилактика" value={p.prevention} />
              </ExpandableCard>
            ))}
          </div>
          <Link
            to={`/guide?crop_id=${crop.id}`}
            className="mt-3 inline-block font-bold text-primary"
          >
            Все проблемы этой культуры в справочнике →
          </Link>
        </section>
      )}

      {(crop.good_neighbors?.length || crop.bad_neighbors?.length || crop.good_predecessors?.length) && (
        <section className="dacha-card p-5">
          <h2 className="mb-2 text-lg font-black">Соседство</h2>
          {crop.good_neighbors?.length ? (
            <p className="mb-1 font-semibold">
              <span className="text-tertiary">✓ Хорошие соседи:</span> {crop.good_neighbors.join(', ')}
            </p>
          ) : null}
          {crop.bad_neighbors?.length ? (
            <p className="mb-1 font-semibold">
              <span className="text-red-600">✗ Плохие соседи:</span> {crop.bad_neighbors.join(', ')}
            </p>
          ) : null}
          {crop.good_predecessors?.length ? (
            <p className="font-semibold">
              <span className="text-tertiary">🔄 Хорошие предшественники:</span>{' '}
              {crop.good_predecessors.join(', ')}
            </p>
          ) : null}
        </section>
      )}

      {crop.notes && (
        <section className="dacha-card p-5">
          <h2 className="mb-2 text-lg font-black">Заметки</h2>
          <p className="font-semibold text-muted">{crop.notes}</p>
        </section>
      )}
    </div>
  )
}
