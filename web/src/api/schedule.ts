import type { ActionLog, CareTask } from './types'

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
  return null
}

// Авто-заметка для care-задачи: только для «Обработки» — уточнение «от чего»
// (напр. «Обработка от капустной мухи» → «от капустной мухи»). Зеркало android treatmentNote.
export function treatmentNote(careTaskName?: string | null): string | undefined {
  if (!careTaskName) return undefined
  if (careTaskActionType(careTaskName) !== 'treatment') return undefined
  const rest = careTaskName.replace(/^обработка\s*/i, '').trim()
  return rest || undefined
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
    rows.push({ name: '🌿 Пересадка/пикировка', dateStr: fmt(d), date: d, status: statusOf('Пересадка', d, null) })
  }

  const limit = harvestDays ?? 120
  careTasks?.forEach((task) => {
    const occ: Date[] = []
    let offset = task.day_offset
    while (offset <= limit) {
      occ.push(addDays(planted, offset))
      if (task.repeat_days == null) break
      offset += task.repeat_days
    }
    occ.forEach((d, i) => {
      rows.push({
        name: task.name,
        dateStr: fmt(d),
        date: d,
        status: statusOf(task.name, d, occ[i + 1] ?? null),
        product: CARE_TASK_PRODUCT[task.name],
      })
    })
  })

  // Полив — предстоящие отметки каждые interval дней (теплица ×0.8). Только будущие.
  if (wateringFreqDays) {
    const interval =
      conditions === 'greenhouse' ? Math.max(1, Math.round(wateringFreqDays * 0.8)) : wateringFreqDays
    if (interval >= 1) {
      const wLimit = Math.min(harvestDays ?? 120, 120)
      let offset = interval
      let shown = 0
      while (offset <= wLimit && shown < 40) {
        const d = addDays(planted, offset)
        if (d >= today) {
          rows.push({ name: '💧 Полив', dateStr: fmt(d), date: d, status: 'upcoming' })
          shown++
        }
        offset += interval
      }
    }
  }

  if (harvestDays) {
    const d = addDays(planted, harvestDays)
    rows.push({ name: '🌾 Сбор урожая', dateStr: fmt(d), date: d, status: 'neutral' })
  }

  return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
}
