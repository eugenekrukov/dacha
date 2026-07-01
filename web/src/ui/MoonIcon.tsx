// Иконка фазы Луны — освещённая часть диска строится по фазе (0=новолуние, 0.5=полнолуние),
// а не выбирается из 8 готовых картинок, поэтому форма плавно меняется день ото дня.
function litPathD(cx: number, cy: number, r: number, phase: number): string {
  const theta = phase * 2 * Math.PI
  const waxing = phase < 0.5
  const baseSign = waxing ? 1 : -1
  const ex = waxing ? r * Math.cos(theta) : -r * Math.cos(theta)
  const steps = 32
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * i) / steps
    pts.push(`${(cx + baseSign * r * Math.sin(t)).toFixed(2)},${(cy - r * Math.cos(t)).toFixed(2)}`)
  }
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI - (Math.PI * i) / steps
    pts.push(`${(cx + ex * Math.sin(t)).toFixed(2)},${(cy - r * Math.cos(t)).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z`
}

export default function MoonIcon({ phaseFraction, size = 28 }: { phaseFraction: number; size?: number }) {
  const r = size / 2 - 1
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden role="img" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="#AEB9CC" />
      <path d={litPathD(cx, cy, r, phaseFraction)} fill="#FFF8EB" />
    </svg>
  )
}
