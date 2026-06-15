import type { ReactNode } from 'react'
import { FlaskConical, RotateCw, Check, X } from 'lucide-react'
import type { Crop, FertilizingEntry, WateringDetails, WateringStage } from '../api/types'

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-3 border-b border-black/5 py-2 last:border-0">
      <span className="font-semibold text-muted">{label}</span>
      <span className="text-right font-bold">{value}</span>
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

// Вкладка/секция «Уход»: сроки, полив по стадиям, схема подкормок (с д.в. удобрений), заметки.
export function CareSection({ crop }: { crop: Crop }) {
  const watering = crop.watering_details
  const wateringStages = watering
    ? (Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[])
        .map((key) => ({ key, label: STAGE_LABELS[key], stage: watering[key] }))
        .filter((s): s is { key: keyof typeof STAGE_LABELS; label: string; stage: WateringStage } => s.stage != null)
    : []
  const schedule = crop.fertilizing_schedule ?? []

  return (
    <div className="flex flex-col gap-4">
      <section className="dacha-card p-5">
        <h2 className="mb-2 text-lg font-black">Сроки и уход</h2>
        <Fact label="Высадка рассады" value={crop.transplant_days ? `через ${crop.transplant_days} дн.` : null} />
        <Fact label="До урожая" value={crop.harvest_days ? `${crop.harvest_days} дн.` : null} />
        <Fact label="Полив" value={crop.watering_freq_days ? `каждые ${crop.watering_freq_days} дн.` : null} />
        <Fact label="Чувствительна к заморозкам" value={crop.frost_sensitive ? 'да' : null} />
        <Fact label="Тип" value={crop.is_perennial ? 'многолетник' : 'однолетник'} />
        <Fact label="Урожай с растения" value={crop.yield_per_plant_kg ? `~${crop.yield_per_plant_kg} кг` : null} />
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
                  <span className="font-bold text-primary">{e.stage ? (FERT_STAGE_LABELS[e.stage] ?? e.stage) : ''}</span>
                  {e.method && (
                    <span className="text-xs font-semibold text-muted">
                      {e.method === 'foliar' ? 'внекорневая' : e.method === 'root' ? 'корневая' : e.method}
                    </span>
                  )}
                </div>
                {e.timing && <p className="text-sm font-semibold text-muted">{e.timing}</p>}
                {e.product_example && (
                  <p className="flex items-center gap-1.5 font-bold">
                    <FlaskConical size={16} aria-hidden className="shrink-0 text-tertiary" />
                    {e.product_example}{e.dose ? ` — ${e.dose}` : ''}
                  </p>
                )}
                {e.notes && <p className="text-sm font-semibold text-muted">{e.notes}</p>}
              </div>
            ))}
          </div>
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

// Вкладка/секция «Соседи»: совместимость и предшественники.
export function NeighborsSection({ crop }: { crop: Crop }) {
  const has = crop.good_neighbors?.length || crop.bad_neighbors?.length || crop.good_predecessors?.length
  if (!has) return <p className="dacha-card p-4 font-semibold text-muted">Данные о совместимости не добавлены.</p>
  return (
    <section className="dacha-card p-5">
      <h2 className="mb-2 text-lg font-black">Соседство</h2>
      {crop.good_neighbors?.length ? (
        <p className="mb-1 font-semibold">
          <span className="inline-flex items-center gap-1 align-middle text-tertiary">
            <Check size={16} aria-hidden /> Хорошие соседи:
          </span>{' '}
          {crop.good_neighbors.join(', ')}
        </p>
      ) : null}
      {crop.bad_neighbors?.length ? (
        <p className="mb-1 font-semibold">
          <span className="inline-flex items-center gap-1 align-middle text-red-600">
            <X size={16} aria-hidden /> Плохие соседи:
          </span>{' '}
          {crop.bad_neighbors.join(', ')}
        </p>
      ) : null}
      {crop.good_predecessors?.length ? (
        <p className="font-semibold">
          <span className="inline-flex items-center gap-1 align-middle text-tertiary">
            <RotateCw size={16} aria-hidden /> Хорошие предшественники:
          </span>{' '}
          {crop.good_predecessors.join(', ')}
        </p>
      ) : null}
    </section>
  )
}
