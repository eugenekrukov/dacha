import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { GuideEntry, GuideKind } from '../api/types'

// Один разворачиваемый пункт болезни/вредителя — идентичен карточке Справочника
// (симптомы, признаки на этой культуре, условия/причина, лечение с д.в., профилактика).
function ProblemCard({ e }: { e: GuideEntry }) {
  const [open, setOpen] = useState(false)
  const isDef = e.kind === 'deficiency'
  return (
    <div className="rounded-card border border-black/10 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left font-bold"
      >
        <span>{e.name}</span>
        <span className="text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          <Row label="Признаки на этой культуре" value={e.signs} highlight />
          {/* «Симптомы» скрываем, если текст дублирует «Признаки на этой культуре». */}
          {e.symptoms && e.symptoms.trim() !== (e.signs ?? '').trim() && (
            <Row label="Симптомы" value={e.symptoms} />
          )}
          <Row label={isDef ? 'Причина' : 'Условия'} value={e.conditions} />
          <Row label={isDef ? 'Коррекция' : 'Лечение'} value={e.treatment} accent />
          <Row label="Профилактика" value={e.prevention} />
          {e.season && <Row label="Период риска" value={e.season} />}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, accent, highlight }: { label: string; value?: string | null; accent?: boolean; highlight?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className={`font-semibold ${accent ? 'text-tertiary' : ''} ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  )
}

// Список проблем одного вида (болезни ИЛИ вредители) для культуры + ссылка в Справочник,
// отфильтрованный по этой культуре (имя видно в фильтре и сбрасывается).
export default function ProblemList({
  entries,
  kind,
  cropId,
  cropName,
  emptyText,
}: {
  entries: GuideEntry[]
  kind: GuideKind
  cropId: number
  cropName?: string | null
  emptyText: string
}) {
  const items = entries.filter((e) => e.kind === kind)
  const guideHref = `/guide?crop_id=${cropId}${cropName ? `&crop=${encodeURIComponent(cropName)}` : ''}`
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="dacha-card p-4 font-semibold text-muted">{emptyText}</p>
      ) : (
        items.map((e) => <ProblemCard key={e.id} e={e} />)
      )}
      <Link to={guideHref} className="mt-1 inline-block font-bold text-primary">
        Все проблемы этой культуры в справочнике →
      </Link>
    </div>
  )
}
