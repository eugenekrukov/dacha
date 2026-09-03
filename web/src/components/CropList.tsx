import { Link } from 'react-router-dom'
import { categoryLabel } from '../api/labels'
import type { Crop } from '../api/types'

// Сетка рендерит карточку в ~230px — полноразмерный оригинал (900px, 100–500 КБ) на
// ~67 культурах разом на медленном канале ощутимо тормозит (грабли 2026-09-03). Превью
// (320px, ~10–30 КБ) — тот же файл в подпапке thumb/, генерируется resize-crop-thumbs.js.
// Деталь культуры (CropDetailScreen) — один оригинал, не сетка, там превью не нужно.
const cropThumbUrl = (url: string) => url.replace('/media/crops/', '/media/crops/thumb/')

// Список культур (карточки-ссылки на деталь), однолетние/многолетние — отдельными группами.
// Вынесено из CropsScreen.tsx, чтобы переиспользовать в ReferenceScreen (см. spec §5 web).
export default function CropList({ crops }: { crops: Crop[] }) {
  const annuals = crops.filter((c) => !c.is_perennial)
  const perennials = crops.filter((c) => c.is_perennial)

  if (crops.length === 0) return null
  if (annuals.length > 0 && perennials.length > 0) {
    return (
      <>
        <CropGroup title="Однолетние" crops={annuals} />
        <CropGroup title="Многолетние" subtitle="не нужно сажать каждый год" crops={perennials} />
      </>
    )
  }
  return <CropGroup crops={crops} />
}

function CropGroup({ title, subtitle, crops }: { title?: string; subtitle?: string; crops: Crop[] }) {
  return (
    <div className="flex flex-col gap-2">
      {title && (
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-black">{title}</h2>
          {subtitle && <span className="text-xs font-semibold text-muted">{subtitle}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {crops.map((c) => (
          <Link key={c.id} to={`/crops/${c.id}`} className="dacha-card-link flex flex-col gap-1 p-4">
            {c.image_url && (
              <img
                src={cropThumbUrl(c.image_url)}
                alt={c.name}
                loading="lazy"
                className="mb-1 aspect-[4/3] w-full rounded-btn object-cover"
              />
            )}
            <span className="font-black">{c.name}</span>
            <div className="flex flex-wrap items-center gap-1">
              {c.category && (
                <span className="text-xs font-semibold text-muted">{categoryLabel(c.category)}</span>
              )}
              {c.is_perennial && (
                <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold text-tertiary">
                  многолетник
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
