// Бренд-знак «подсолнух» — простой SVG вместо системного эмодзи 🌻
// (эмодзи рендерятся по-разному на платформах и выглядят неконсистентно).
export default function Sunflower({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden role="img" className="shrink-0">
      <g fill="#FF7B00">
        {Array.from({ length: 12 }).map((_, i) => (
          <ellipse key={i} cx="12" cy="4" rx="1.7" ry="3.4" transform={`rotate(${i * 30} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="4.2" fill="#6B4A2E" />
    </svg>
  )
}
