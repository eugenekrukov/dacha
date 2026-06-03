'use strict'

// Care-action_type'ы, которыми Android закрывает care-задачи. Этот же список —
// в SQL-фильтрах today.js / plantings.js (lastCareActionMap, careActionsToday).
const CARE_ACTION_TYPES = ['tying', 'pinching', 'hilling', 'pruning', 'weeding', 'loosening', 'treatment']

// Сопоставление имени care_task (из БД) → action_type (что пишет Android).
// По КЛЮЧЕВОМУ СЛОВУ, а не дословно: имена в БД описательные («Первое окучивание»,
// «Обработка от капустной мухи», «Обрезка нижних листьев», «Прищипка верхушки»).
// ВАЖНО: держать в синхроне с careTaskActionType() на Android (ActionLogViewModel.kt)
// и со списком CARE_ACTION_TYPES в SQL. Незамапленные имена (Прореживание, Прекратить
// полив, Удаление стрелок) → null: для них нет подходящего действия.
function careTaskActionType(name) {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('подвяз'))                            return 'tying'
  if (n.includes('пасынк') || n.includes('прищип'))    return 'pinching'
  if (n.includes('окучив'))                            return 'hilling'
  if (n.includes('обрезк'))                            return 'pruning'
  if (n.includes('прополк'))                           return 'weeding'
  if (n.includes('рыхлен'))                            return 'loosening'
  if (n.includes('обработк') || n.includes('опрыск'))  return 'treatment'
  return null
}

const TASK_PRIORITY = {
  frost_alert:      1,
  transplant_due:   2,
  care_task_due:    3,
  watering_due:     4,
  fertilizing_due:  5,
  harvest_due:      6,
  reminder:         7,
}

/**
 * Вычисляет ближайшую дату наступления care_task для посадки.
 * Используется в GET /plantings для поля next_care_task.
 */
function getNextCareTask(careTasks, daysSincePlanting, harvestDays) {
  if (!careTasks || careTasks.length === 0) return null
  const limit = harvestDays || 180
  let nextTask = null
  let nextDays = Infinity

  for (const task of careTasks) {
    let offset = task.day_offset
    while (offset <= limit) {
      if (offset > daysSincePlanting) {
        const daysUntil = offset - daysSincePlanting
        if (daysUntil < nextDays) {
          nextDays = daysUntil
          nextTask = { name: task.name, days_until: daysUntil }
        }
        break
      }
      if (!task.repeat_days) break
      offset += task.repeat_days
    }
  }
  return nextTask
}

/**
 * Возвращает самую просроченную (или наступившую сегодня) НЕвыполненную care-задачу
 * для одной посадки — источник индикатора «Требует ухода» на экране «Посадки».
 * В отличие от getNextCareTask (только будущие задачи), здесь рассматриваются только
 * наступившие: dueOffset <= daysSincePlanting. Логика «выполнено» идентична buildTasks
 * (doneSinceDue / doneToday), чтобы экраны «Сегодня» и «Посадки» не расходились.
 *
 * @returns {{ name: string, days_overdue: number } | null}
 */
function getOverdueCareTask(careTasks, plantedAt, today, harvestDays, lastCareDone = {}, todayActions = []) {
  if (!careTasks || careTasks.length === 0) return null
  const limit = harvestDays || 180
  const daysSincePlanting = Math.floor((today - plantedAt) / 86400000)
  let best = null

  for (const task of careTasks) {
    // Последняя наступившая дата задачи (<= сегодня)
    let dueOffset = null
    let offset = task.day_offset
    while (offset <= limit && offset <= daysSincePlanting) {
      dueOffset = offset
      if (!task.repeat_days) break
      offset += task.repeat_days
    }
    if (dueOffset === null) continue // ещё не наступила

    const mappedAction = careTaskActionType(task.name)
    const dueDate = new Date(plantedAt.getTime() + dueOffset * 86400000)
    const lastDone = mappedAction ? lastCareDone[mappedAction] : null
    const doneSinceDue = lastDone && new Date(lastDone) >= dueDate
    const doneToday = mappedAction && todayActions.includes(mappedAction)
    if (doneSinceDue || doneToday) continue

    const daysOverdue = daysSincePlanting - dueOffset
    if (!best || daysOverdue > best.days_overdue) {
      best = { name: task.name, days_overdue: daysOverdue }
    }
  }
  return best
}

/**
 * Чистая функция сборки задач дня.
 * @param careActionsToday — { plantingId: string[] } — действия, залогированные сегодня
 */
// Перечисляет культуры человекочитаемо: «Томат, Огурец и ещё 2».
function listCrops(crops) {
  const max = 3
  if (crops.length <= max) return crops.join(', ')
  return `${crops.slice(0, max).join(', ')} и ещё ${crops.length - max}`
}

function buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminders, today = new Date(), careActionsToday = {}, precipProb = null, lastCareActionMap = {}) {
  // Если завтра дождь ≥70% — полив не нужен
  const rainExpected = precipProb !== null && precipProb >= 70
  const tasks = []
  const careAccum = [] // care-задачи копим отдельно — потом группируем однотипные

  for (const p of plantings) {
    const plantedAt = new Date(p.planted_at)
    const daysSincePlanting = Math.floor((today - plantedAt) / 86400000)

    // 🚨 Угроза заморозков
    if (p.frost_sensitive && weather && weather.frost_risk === true) {
      tasks.push({
        type: 'frost_alert',
        priority: TASK_PRIORITY.frost_alert,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `Угроза заморозков! Защитите ${p.crop_name}`,
      })
    }

    // 🌱 Пора пересаживать в грунт
    const todayActions = careActionsToday[p.id] || []
    if (
      p.transplant_days &&
      daysSincePlanting >= p.transplant_days &&
      ['sowing', 'sprouted'].includes(p.stage) &&
      !todayActions.includes('transplanting')
    ) {
      tasks.push({
        type: 'transplant_due',
        priority: TASK_PRIORITY.transplant_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора высаживать в грунт (${daysSincePlanting} дней)`,
        days_overdue: daysSincePlanting - p.transplant_days,
      })
    }

    // 🌿 care_tasks — показываем с +3 дней до наступления и ПОКА не выполнено
    // (просрочка не «теряется», как у полива/подкормки). «Выполнено» = соответствующее
    // действие залогировано в день наступления задачи или позже.
    const careTasks = p.care_tasks || []
    const careLimit = p.harvest_days || 180
    const lastCareDone = lastCareActionMap[p.id] || {}
    const addedCareNames = new Set()
    for (const task of careTasks) {
      // Находим последнюю наступившую (или близкую, до +3 дней) дату задачи
      let dueOffset = null
      let offset = task.day_offset
      while (offset <= careLimit && offset <= daysSincePlanting + 3) {
        dueOffset = offset
        if (!task.repeat_days) break
        offset += task.repeat_days
      }
      if (dueOffset === null) continue // ещё не наступила

      const key = `${p.id}:${task.name}`
      if (addedCareNames.has(key)) continue

      const mappedAction = careTaskActionType(task.name)
      const dueDate = new Date(plantedAt.getTime() + dueOffset * 86400000)
      const lastDone = mappedAction ? lastCareDone[mappedAction] : null
      const doneSinceDue = lastDone && new Date(lastDone) >= dueDate
      const doneToday = mappedAction && todayActions.includes(mappedAction)
      if (doneSinceDue || doneToday) continue

      addedCareNames.add(key)
      const diff = dueOffset - daysSincePlanting // <= 3; отрицательный = просрочено
      const when = diff <= 0 ? 'сегодня' : `через ${diff} дн.`
      careAccum.push({
        type: 'care_task_due',
        priority: TASK_PRIORITY.care_task_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        care_task_name: task.name,
        message: `${p.crop_name}: ${task.name} — ${when}`,
        days_overdue: diff < 0 ? -diff : 0,
      })
    }

    // 💧 Нужен полив (пропускаем если ожидается дождь ≥70%)
    if (p.watering_freq_days && !rainExpected) {
      const lastWatered = lastWateredMap[p.id] || plantedAt
      const daysSinceWatering = Math.floor((today - lastWatered) / 86400000)
      const freq = p.conditions === 'greenhouse'
        ? Math.ceil(p.watering_freq_days * 1.3)
        : p.watering_freq_days
      if (daysSinceWatering >= freq) {
        tasks.push({
          type: 'watering_due',
          priority: TASK_PRIORITY.watering_due,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `${p.crop_name} — нужен полив (${daysSinceWatering} дн. без воды)`,
          days_overdue: daysSinceWatering - freq,
        })
      }
    }

    // 🌿 Нужна подкормка (по fertilizing_schedule для текущей стадии)
    const fertilizingSchedule = p.fertilizing_schedule || []
    const fertEntry = fertilizingSchedule.find(f => f.stage === p.stage)
    if (fertEntry && !todayActions.includes('fertilizing')) {
      const lastFertilized = lastFertilizedMap[p.id] || plantedAt
      const daysSinceFertilized = Math.floor((today - lastFertilized) / 86400000)
      if (daysSinceFertilized > 14) {
        tasks.push({
          type: 'fertilizing_due',
          priority: TASK_PRIORITY.fertilizing_due,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `${p.crop_name} — нужна подкормка (${daysSinceFertilized} дн. без удобрений)`,
          days_overdue: daysSinceFertilized - 14,
          product_example: fertEntry.product_example || null,
        })
      }
    }

    // 🌾 Пора убирать урожай
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      ['growing', 'flowering', 'harvesting', 'transplanted'].includes(p.stage)
    ) {
      tasks.push({
        type: 'harvest_due',
        priority: TASK_PRIORITY.harvest_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора убирать урожай!`,
      })
    }
  }

  // Группируем однотипные care-задачи (одно имя на несколько посадок) в одну карточку,
  // чтобы они не вытесняли полив/урожай из топа. Одиночные остаются адресными
  // (с planting_id → tappable + индикатор «Требуется» на карточке посадки).
  const byCareName = new Map()
  for (const t of careAccum) {
    if (!byCareName.has(t.care_task_name)) byCareName.set(t.care_task_name, [])
    byCareName.get(t.care_task_name).push(t)
  }
  for (const [name, group] of byCareName) {
    if (group.length === 1) {
      tasks.push(group[0])
    } else {
      const crops = group.map(g => g.crop_name)
      tasks.push({
        type: 'care_task_due',
        priority: TASK_PRIORITY.care_task_due,
        planting_id: null, // групповая — без адресной посадки (информационная)
        crop_name: null,
        care_task_name: name,
        crops,
        message: `${name}: ${listCrops(crops)}`,
        days_overdue: Math.max(...group.map(g => g.days_overdue || 0)),
      })
    }
  }

  tasks.push(...reminders)

  tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return (b.days_overdue || 0) - (a.days_overdue || 0)
  })

  return tasks.slice(0, 7) // увеличили с 5 до 7 для ведения по флоу
}

function formatTasks(tasks) {
  return tasks.map(t => {
    // Короткий actionable заголовок — помещается в одну строку карточки
    let title
    switch (t.type) {
      case 'watering_due':     title = `Полить: ${t.crop_name}`; break
      case 'transplant_due':   title = `Высадить в грунт: ${t.crop_name}`; break
      case 'fertilizing_due':  title = t.product_example ? `Подкормить ${t.crop_name} (${t.product_example})` : `Подкормить: ${t.crop_name}`; break
      case 'harvest_due':      title = `Убрать урожай: ${t.crop_name}`; break
      case 'frost_alert':      title = `Заморозки: ${t.crop_name}`; break
      case 'care_task_due':    title = (t.crops && t.crops.length)
                                 ? `${t.care_task_name}: ${listCrops(t.crops)}`
                                 : `${t.care_task_name}: ${t.crop_name}`; break
      default:                 title = t.message || t.type
    }

    // Описание с деталями
    let description
    if (t.type === 'watering_due') {
      description = t.days_overdue > 0
        ? `Просрочено на ${t.days_overdue} дн.`
        : 'Пора полить сегодня'
    } else if (t.type === 'transplant_due') {
      description = t.days_overdue > 0
        ? `Просрочено на ${t.days_overdue} дн.`
        : 'Пора высаживать'
    } else if (t.type === 'harvest_due') {
      description = 'Урожай готов к сбору'
    } else if (t.type === 'fertilizing_due') {
      description = t.product_example
        ? `${t.product_example}`
        : t.days_overdue > 0 ? `Просрочено на ${t.days_overdue} дн.` : 'Сделайте сегодня'
    } else if (t.type === 'frost_alert') {
      description = 'Защитите растение от мороза'
    } else if (t.type === 'care_task_due') {
      description = t.days_overdue > 0
        ? `Просрочено на ${t.days_overdue} дн.`
        : 'Сделайте сегодня'
    } else {
      description = t.crop_name ? `Культура: ${t.crop_name}` : ''
    }

    return {
      type: t.type,
      priority: t.priority,
      title,
      description,
      planting_id: t.planting_id || null,
      crop_name: t.crop_name || null,
      days_overdue: t.days_overdue || null,
      care_task_name: t.care_task_name || t.product_example || null,
    }
  })
}

module.exports = { buildTasks, formatTasks, getNextCareTask, getOverdueCareTask, careTaskActionType, CARE_ACTION_TYPES }
