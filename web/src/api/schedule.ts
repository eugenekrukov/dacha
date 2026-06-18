import type { ActionLog, CareTask, Crop, Planting, TodayTask } from './types'

// Рекомендованный препарат для care-задач-обработок (зеркало CARE_TASK_PRODUCT в backend todayLogic.js).
export const CARE_TASK_PRODUCT: Record<string, string> = {
  'Обработка от фитофторы': 'Ридомил Голд, бордоская смесь',
  'Обработка от капустной мухи': 'Базудин',
  'Обработка от серой гнили': 'Свитч, Фундазол',
  'Обработка от мучнистой росы': 'Топаз, коллоидная сера',
  'Обработка от тли': 'Фитоверм, зелёное мыло',
  'Обработка от колорадского жука': 'Престиж, Командор',
}

// Имя care-задачи → action_type (зеркало careTaskActionType в backend/Android). null = нет действия.
export function careTaskActionType(name: string): string | null {
  const n = (name || '').toLowerCase()
  if (n.includes('подвяз')) return 'tying'
  if (n.includes('пасынк') || n.includes('прищип')) return 'pinching'
  if (n.includes('окучив')) return 'hilling'
  if (n.includes('обрезк')) return 'pruning'
  if (n.includes('прополк')) return 'weeding'
  if (n.includes('рыхлен')) return 'loosening'
  if (n.includes('обработк') || n.includes('опрыск')) return 'treatment'
  if (n.includes('прореж') || n.includes('нормиров')) return 'thinning'
  if (n.includes('усов') || n.includes('усы')) return 'runner_removal'
  if (n.includes('стрел')) return 'bolt_removal'
  if (n.includes('цветонос') || n.includes('увядш') || n.includes('завяз')) return 'deflowering'
  if (n.includes('опор')) return 'staking'
  return null
}

// Авто-заметка для care-задачи-обработки: «от чего - препарат»
// (напр. «Обработка от капустной мухи» + «Базудин» → «от капустной мухи - Базудин»).
// Если препарат не передан — берём рекомендованный из CARE_TASK_PRODUCT. Зеркало android treatmentNote.
export function treatmentNote(careTaskName?: string | null, product?: string | null): string | undefined {
  if (!careTaskName) return undefined
  if (careTaskActionType(careTaskName) !== 'treatment') return undefined
  const target = careTaskName.replace(/^обработка\s*/i, '').trim()
  const prod = (product || CARE_TASK_PRODUCT[careTaskName] || '').trim()
  if (target && prod) return `${target} - ${prod}`
  return target || prod || undefined
}

// ─── История действий: схлопывание подряд идущих однотипных записей ───
// Журнал/история не должны быть «стеной» одинаковых поливов через день. Склеиваем
// подряд идущие записи одного типа БЕЗ пользовательской заметки в одну строку со счётчиком
// и диапазоном дат. Записи с заметкой остаются отдельными (заметка важна).
export interface ActionGroup {
  id: number
  action_type: string
  crop_name?: string | null
  note?: string | null
  count: number
  firstAt: string // самая старая в серии
  lastAt: string // самая свежая в серии
}

export function collapseActions(actions: ActionLog[]): ActionGroup[] {
  const out: ActionGroup[] = []
  for (const a of actions) {
    const note = a.notes && !a.auto ? a.notes : null
    const last = out[out.length - 1]
    if (last && last.action_type === a.action_type && (last.crop_name ?? null) === (a.crop_name ?? null) && !note && !last.note) {
      last.count++
      last.firstAt = a.logged_at // список идёт от свежих к старым → старая дата уходит вниз
    } else {
      out.push({ id: a.id, action_type: a.action_type, crop_name: a.crop_name, note, count: 1, firstAt: a.logged_at, lastAt: a.logged_at })
    }
  }
  return out
}

export type SchedStatus = 'done' | 'missed' | 'upcoming' | 'neutral'

export interface SchedRow {
  name: string
  dateStr: string
  date: Date
  status: SchedStatus
  product?: string
}

const DAY = 86_400_000
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const midnight = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const fmt = (d: Date) => d.toLocaleDateString('ru-RU')

function actionDate(iso: string): Date | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : midnight(d)
}

// Какие action_type закрывают строку расписания. null → статус нейтральный.
function rowActionTypes(name: string): Set<string> | null {
  const n = name.toLowerCase()
  if (n.includes('пересадк') || n.includes('пикировк')) return new Set(['transplanting', 'pricking_out'])
  if (n.includes('урожай')) return null
  const t = careTaskActionType(name)
  return t ? new Set([t]) : null
}

/**
 * Расписание работ со статусом: done (выполнено), missed (просрочено), upcoming (предстоит),
 * neutral (урожай). «Выполнено» = действие нужного типа в окне [дата_работы, дата_след_повтора).
 * Порт android PlantingInfoBottomSheet.buildSchedule.
 */
export function buildSchedule(opts: {
  transplantDays?: number | null
  careTasks?: CareTask[] | null
  harvestDays?: number | null
  wateringFreqDays?: number | null
  conditions?: string | null
  sowingMethod?: string | null
  planted: Date
  actions: ActionLog[]
  today: Date
}): SchedRow[] {
  const { transplantDays, careTasks, harvestDays, wateringFreqDays, conditions, sowingMethod, actions } = opts
  const planted = midnight(opts.planted)
  const today = midnight(opts.today)
  const rows: SchedRow[] = []

  const statusOf = (name: string, date: Date, next: Date | null): SchedStatus => {
    const types = rowActionTypes(name)
    if (!types) return 'neutral'
    const done = actions.some((a) => {
      if (!types.has(a.action_type)) return false
      const d = actionDate(a.logged_at)
      return d != null && d >= date && (next == null || d < next)
    })
    if (done) return 'done'
    return date < today ? 'missed' : 'upcoming'
  }

  // Пересадка/пикировка — только для рассадного способа
  if (sowingMethod !== 'direct' && transplantDays) {
    const d = addDays(planted, transplantDays)
    rows.push({ name: 'Пересадка/пикировка', dateStr: fmt(d), date: d, status: statusOf('Пересадка', d, null) })
  }

  const limit = harvestDays ?? 120
  // Повторяющиеся задачи НЕ разворачиваем в десятки строк «через день»: показываем одну —
  // текущую актуальную (ближайшую будущую, либо просроченную невыполненную) + «каждые N дн.».
  // Разовые задачи (пикировка, единичный уход) показываем как есть. Прошлые выполненные
  // повторы не дублируем — они видны в «Истории действий».
  careTasks?.forEach((task) => {
    const occ: Date[] = []
    let offset = task.day_offset
    while (offset <= limit) {
      occ.push(addDays(planted, offset))
      if (task.repeat_days == null) break
      offset += task.repeat_days
    }
    const product = CARE_TASK_PRODUCT[task.name]
    if (task.repeat_days == null) {
      const d = occ[0]
      rows.push({ name: task.name, dateStr: fmt(d), date: d, status: statusOf(task.name, d, null), product })
      return
    }
    // Повторяющаяся: индекс ближайшей будущей даты (или последней, если все в прошлом).
    const idx = occ.findIndex((d) => d >= today)
    const repIdx = idx >= 0 ? idx : occ.length - 1
    const d = occ[repIdx]
    rows.push({
      name: `${task.name} (каждые ${task.repeat_days} дн.)`,
      dateStr: fmt(d),
      date: d,
      status: statusOf(task.name, d, occ[repIdx + 1] ?? null),
      product,
    })
  })

  // Полив — одна строка: ближайший будущий полив + «каждые N дн.» (теплица ×0.8).
  if (wateringFreqDays) {
    const interval =
      conditions === 'greenhouse' ? Math.max(1, Math.round(wateringFreqDays * 0.8)) : wateringFreqDays
    if (interval >= 1) {
      const wLimit = Math.min(harvestDays ?? 120, 120)
      let offset = interval
      while (offset <= wLimit && addDays(planted, offset) < today) offset += interval
      if (offset <= wLimit) {
        const d = addDays(planted, offset)
        rows.push({ name: `Полив (каждые ${interval} дн.)`, dateStr: fmt(d), date: d, status: 'upcoming' })
      }
    }
  }

  if (harvestDays) {
    const d = addDays(planted, harvestDays)
    rows.push({ name: 'Сбор урожая', dateStr: fmt(d), date: d, status: 'neutral' })
  }

  return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ─── Календарь: сборка событий (порт android CalendarViewModel.buildEvents) ───
// Reminders и snooze в вебе пока не поддерживаются → не учитываются.

export type CalendarEventType =
  | 'reminder' | 'harvest' | 'sowing' | 'watering' | 'care'
  | 'watering_due' | 'fertilizing_due' | 'transplant_due' | 'harvest_due' | 'frost_alert' | string

export interface CalendarEvent {
  date: string // ISO yyyy-mm-dd (локальная дата)
  title: string
  type: CalendarEventType
}

const isoKey = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Парсит первые 10 символов ISO ('2026-06-14') в локальную дату на полночь.
function parseDateOnly(iso?: string | null): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Сезонный сброс отсчёта для многолетников — зеркало backend effectivePlantedAt (utils/todayLogic.js).
function effectivePlanted(planted: Date, isPerennial: boolean, today: Date): Date {
  if (!isPerennial) return planted
  if (today.getTime() - planted.getTime() < 365 * DAY) return planted
  const anniv = new Date(planted)
  anniv.setFullYear(today.getFullYear())
  if (anniv.getTime() - today.getTime() > 31 * DAY) anniv.setFullYear(today.getFullYear() - 1)
  return anniv
}

function wateringInterval(freqDays: number, conditions?: string | null): number {
  const base = freqDays || 3
  return conditions === 'greenhouse' ? Math.max(1, Math.round(base * 0.8)) : base
}

/**
 * Строит карту «дата (ISO) → события» на горизонт 60 дней.
 * Источники: задачи дня (/today), посадки (+ care_tasks культуры). Завершённые посадки пропускаются.
 */
export function buildCalendarEvents(opts: {
  plantings: Planting[]
  crops: Crop[]
  todayTasks: TodayTask[]
  today: Date
}): Record<string, CalendarEvent[]> {
  const today = midnight(opts.today)
  const horizon = addDays(today, 60)
  const result: Record<string, CalendarEvent[]> = {}
  const push = (date: Date, title: string, type: CalendarEventType) => {
    const key = isoKey(date)
    ;(result[key] ??= []).push({ date: key, title, type })
  }
  const inWindow = (d: Date) => d.getTime() >= today.getTime() && d.getTime() <= horizon.getTime()

  const cropsById = new Map(opts.crops.map((c) => [c.id, c]))
  const doneIds = new Set(opts.plantings.filter((p) => p.stage === 'done').map((p) => p.id))

  // Задачи из /today — на сегодняшнюю дату
  for (const t of opts.todayTasks) {
    if (t.planting_id != null && doneIds.has(t.planting_id)) continue
    const crop = t.crop_name ?? ''
    const label =
      t.type === 'watering_due' ? `Полив: ${crop}`
      : t.type === 'fertilizing_due' ? `Подкормка: ${crop}`
      : t.type === 'transplant_due' ? `Пересадка: ${crop}`
      : t.type === 'harvest_due' ? `Урожай: ${crop}`
      : t.type === 'frost_alert' ? 'Угроза заморозков'
      : t.title
    push(today, label, t.type)
  }

  // Посадки (кроме завершённых)
  for (const p of opts.plantings) {
    if (p.stage === 'done') continue
    const cropName = p.crop_name ?? 'культура'
    const crop = cropsById.get(p.crop_id)
    const realSown = parseDateOnly(p.planted_at)
    if (!realSown) continue
    const isPerennial = crop?.is_perennial === true
    const sown = effectivePlanted(realSown, isPerennial, today)

    // Дата посева (реальная) — попадёт в окно только для свежих посадок
    if (inWindow(realSown)) push(realSown, `Посев: ${cropName}`, 'sowing')

    // Ожидаемый урожай = посев + harvest_days
    const harvestDays = crop?.harvest_days ?? p.harvest_days ?? null
    if (harvestDays != null) {
      const d = addDays(sown, harvestDays)
      if (inWindow(d)) push(d, `Урожай: ${cropName}`, 'harvest')
    }

    // Полив — от последнего действия или от посева
    const wBase = parseDateOnly(p.last_action_at) ?? sown
    const freq = wateringInterval(p.watering_freq_days ?? 3, p.conditions)
    let nextW = addDays(wBase, freq)
    while (nextW.getTime() <= horizon.getTime()) {
      if (nextW.getTime() >= today.getTime()) push(nextW, `Полив: ${cropName}`, 'watering')
      nextW = addDays(nextW, freq)
    }

    // Пересадка/пикировка
    if (crop?.transplant_days != null) {
      const d = addDays(sown, crop.transplant_days)
      if (inWindow(d)) push(d, `Пересадка: ${cropName}`, 'care')
    }

    // care_tasks — разворачиваем до горизонта
    const limit = crop?.harvest_days ?? 180
    for (const task of crop?.care_tasks ?? []) {
      let offset = task.day_offset
      while (offset <= limit) {
        const d = addDays(sown, offset)
        if (inWindow(d)) push(d, `${task.name}: ${cropName}`, 'care')
        if (task.repeat_days == null) break
        offset += task.repeat_days
        if (d.getTime() > horizon.getTime()) break
      }
    }
  }

  return result
}
