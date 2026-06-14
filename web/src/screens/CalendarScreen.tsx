import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api/client'
import { buildCalendarEvents, type CalendarEvent } from '../api/schedule'
import { useGardens } from '../garden/GardenContext'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const isoKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Цвет точки/полоски события по типу (зеркало android eventStyle).
function eventColor(type: string): string {
  if (type.startsWith('harvest')) return '#4CAF50'
  if (type === 'sowing') return '#8D6E63'
  if (type.startsWith('watering')) return '#2196F3'
  if (type.startsWith('fertilizing')) return '#9C27B0'
  if (type === 'transplant_due' || type === 'care') return '#795548'
  if (type === 'frost_alert') return '#00BCD4'
  return '#FFB300'
}

export default function CalendarScreen() {
  const { gardenId } = useGardens()
  const [eventsByDay, setEventsByDay] = useState<Record<string, CalendarEvent[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => ({ year: today.getFullYear(), m: today.getMonth() }))
  const [selected, setSelected] = useState<string | null>(() => isoKey(today))

  useEffect(() => {
    if (gardenId === -1) return
    setLoading(true)
    Promise.all([
      api.getPlantings(gardenId),
      api.getCrops(),
      api.getToday(gardenId).then((r) => r.tasks).catch(() => []),
    ])
      .then(([plantings, crops, tasks]) => {
        setEventsByDay(buildCalendarEvents({ plantings, crops, todayTasks: tasks, today: new Date() }))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить календарь'))
      .finally(() => setLoading(false))
  }, [gardenId])

  // Сетка месяца: ведущие пустые ячейки (Пн=0) + дни месяца
  const cells = useMemo(() => {
    const first = new Date(month.year, month.m, 1)
    const lead = (first.getDay() + 6) % 7 // Пн-based
    const daysInMonth = new Date(month.year, month.m + 1, 0).getDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(month.year, month.m, d))
    return arr
  }, [month])

  const prevMonth = () => setMonth((s) => (s.m === 0 ? { year: s.year - 1, m: 11 } : { year: s.year, m: s.m - 1 }))
  const nextMonth = () => setMonth((s) => (s.m === 11 ? { year: s.year + 1, m: 0 } : { year: s.year, m: s.m + 1 }))

  const todayKey = isoKey(today)
  const selectedEvents = selected ? eventsByDay[selected] ?? [] : []
  const selectedLabel = selected
    ? (() => {
        const [, mm, dd] = selected.split('-').map(Number)
        return `${dd} ${MONTHS[mm - 1].toLowerCase()}`
      })()
    : ''

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Календарь</h1>

      {error && <div className="dacha-card p-4 font-semibold text-muted">{error}</div>}

      {/* Навигатор месяца */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} aria-label="Предыдущий месяц" className="rounded-btn px-3 py-1 text-xl font-black text-primary">
          ‹
        </button>
        <span className="text-base font-black">
          {MONTHS[month.m]} {month.year}
        </span>
        <button onClick={nextMonth} aria-label="Следующий месяц" className="rounded-btn px-3 py-1 text-xl font-black text-primary">
          ›
        </button>
      </div>

      {/* Сетка месяца */}
      <div className="dacha-card p-3">
        <div className="mb-1 grid grid-cols-7">
          {DAY_HEADERS.map((h) => (
            <div key={h} className="py-1 text-center text-xs font-bold text-muted">
              {h}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />
            const key = isoKey(date)
            const has = !!eventsByDay[key]?.length
            const isToday = key === todayKey
            const isSelected = key === selected
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`flex aspect-square flex-col items-center justify-center rounded-full text-[13px] font-bold transition ${
                  isSelected
                    ? 'bg-primary text-white'
                    : isToday
                      ? 'bg-primary/15 text-primary'
                      : 'text-[#3a2a1a] hover:bg-background'
                }`}
              >
                <span>{date.getDate()}</span>
                {has && (
                  <span
                    className="mt-0.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: isSelected ? '#fff' : '#2E7D32' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* События выбранного дня */}
      {selected && (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-black">{selectedLabel}</h2>
          {loading ? (
            <p className="font-bold text-muted">Загрузка…</p>
          ) : selectedEvents.length === 0 ? (
            <p className="font-semibold text-muted">Задач на этот день нет</p>
          ) : (
            selectedEvents.map((ev, i) => (
              <div key={i} className="dacha-card flex items-center gap-3 p-3">
                <span
                  className="h-9 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: eventColor(ev.type) }}
                />
                <span className="font-semibold">{ev.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
