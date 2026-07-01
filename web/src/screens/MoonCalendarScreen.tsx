import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, CircleMinus } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { MoonDay } from '../api/types'
import ErrorCard from '../components/ErrorCard'
import MoonIcon from '../ui/MoonIcon'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const isoKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// «🌕 Полнолуние» → «Полнолуние» — своя иконка диска рисуется рядом, эмодзи дублировал бы её.
const stripEmoji = (label: string) => label.split(' ').slice(1).join(' ')

const weekdayDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const s = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function MoonCalendarScreen() {
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => ({ year: today.getFullYear(), m: today.getMonth() }))
  const [days, setDays] = useState<MoonDay[]>([])
  const [selected, setSelected] = useState<string>(() => isoKey(today))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getMoonCalendar(month.year, month.m + 1)
      .then((res) => {
        setDays(res.days)
        // при смене месяца показываем сегодняшний день (если он в этом месяце) иначе первый
        setSelected((prev) => (res.days.some((d) => d.date === prev) ? prev : res.days[0]?.date ?? prev))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить лунный календарь'))
      .finally(() => setLoading(false))
  }, [month])

  const cells = useMemo(() => {
    const first = new Date(month.year, month.m, 1)
    const lead = (first.getDay() + 6) % 7 // Пн-based
    const arr: (MoonDay | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (const d of days) arr.push(d)
    return arr
  }, [month, days])

  const prevMonth = () => setMonth((s) => (s.m === 0 ? { year: s.year - 1, m: 11 } : { year: s.year, m: s.m - 1 }))
  const nextMonth = () => setMonth((s) => (s.m === 11 ? { year: s.year + 1, m: 0 } : { year: s.year, m: s.m + 1 }))

  const todayKey = isoKey(today)
  const selectedDay = days.find((d) => d.date === selected) ?? null

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-left font-bold text-muted">
        <ArrowLeft size={18} aria-hidden /> Назад
      </button>
      <h1 className="text-2xl font-black">Лунный календарь</h1>

      {error && <ErrorCard message={error} />}

      {selectedDay && (
        <div className="dacha-card flex items-center gap-4 p-4">
          <MoonIcon phaseFraction={selectedDay.phaseFraction} size={56} />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-muted">{weekdayDate(selectedDay.date)}</span>
            <span className="text-lg font-black">{stripEmoji(selectedDay.phaseLabel)}</span>
            {selectedDay.label && (
              <span className="mt-0.5 flex items-center gap-1 text-sm font-bold text-muted">
                <CircleMinus size={14} aria-hidden /> Не сажать
              </span>
            )}
          </div>
        </div>
      )}

      {selectedDay && <p className="-mt-2 font-semibold text-muted">{selectedDay.message}</p>}

      <div className="flex items-center justify-between">
        <button onClick={prevMonth} aria-label="Предыдущий месяц" className="rounded-btn px-3 py-1 text-xl font-black text-primary">
          <ChevronLeft aria-hidden />
        </button>
        <span className="text-base font-black">
          {MONTHS[month.m]} {month.year}
        </span>
        <button onClick={nextMonth} aria-label="Следующий месяц" className="rounded-btn px-3 py-1 text-xl font-black text-primary">
          <ChevronRight aria-hidden />
        </button>
      </div>

      <div className="dacha-card p-3">
        <div className="mb-1 grid grid-cols-7">
          {DAY_HEADERS.map((h) => (
            <div key={h} className="py-1 text-center text-xs font-bold text-muted">
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />
            const isToday = day.date === todayKey
            const isSelected = day.date === selected
            const dayNum = Number(day.date.slice(-2))
            return (
              <button
                key={day.date}
                onClick={() => setSelected(day.date)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1 transition ${
                  isSelected ? 'border-2 border-primary' : isToday ? 'bg-primary/10' : ''
                }`}
              >
                <span className="text-[11px] font-bold text-muted">{dayNum}</span>
                <MoonIcon phaseFraction={day.phaseFraction} size={24} />
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: day.favorable ? '#2E7D32' : '#C7CDD8' }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {loading && <p className="text-center font-bold text-muted">Загрузка…</p>}
    </div>
  )
}
