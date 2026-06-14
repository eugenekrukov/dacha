'use strict'

// Care-action_type'ы, которыми Android закрывает care-задачи. Этот же список —
// в SQL-фильтрах today.js / plantings.js (lastCareActionMap, careActionsToday).
const CARE_ACTION_TYPES = ['tying', 'pinching', 'hilling', 'pruning', 'weeding', 'loosening', 'treatment',
  'thinning', 'runner_removal', 'bolt_removal', 'deflowering', 'staking']

// Окно давности: care-задачи и пересадку, просроченные больше этого срока, не показываем —
// иначе посадка с датой год назад выдаёт «лавину» давно пропущенных задач (см. effectivePlantedAt).
const OVERDUE_WINDOW_DAYS = 21

// Сопоставление имени care_task (из БД) → action_type (что пишет Android).
// По КЛЮЧЕВОМУ СЛОВУ, а не дословно: имена в БД описательные («Первое окучивание»,
// «Обработка от капустной мухи», «Обрезка нижних листьев», «Прищипка верхушки»).
// ВАЖНО: держать в синхроне с careTaskActionType() на Android (ActionLogViewModel.kt)
// и со списком CARE_ACTION_TYPES в SQL. Незамапленные имена (Прореживание, Прекратить
// полив, Удаление стрелок) → null: для них нет подходящего действия.
// Рекомендованный препарат для care-задач-обработок (что/чем). Подсказка пользователю
// «чем обрабатывать» + авто-подстановка в заметку. Ключ = каноничное имя из 008_care_tasks.
// Источник: treatment в базе знаний (006_seed_crops_extended.sql).
const CARE_TASK_PRODUCT = {
  'Обработка от фитофторы':            'Ридомил Голд, бордоская смесь',
  'Обработка от капустной мухи':       'Базудин',
  'Обработка от серой гнили':          'Свитч, Фундазол',
  'Обработка от мучнистой росы':       'Топаз, коллоидная сера',
  'Обработка от тли':                  'Фитоверм, зелёное мыло',
  'Обработка от колорадского жука':    'Престиж, Командор',
}

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
  if (n.includes('прореж') || n.includes('нормиров'))  return 'thinning'
  if (n.includes('усов') || n.includes('усы'))         return 'runner_removal'
  if (n.includes('стрел'))                             return 'bolt_removal'
  if (n.includes('цветонос') || n.includes('увядш') || n.includes('завяз')) return 'deflowering'
  if (n.includes('опор'))                              return 'staking'
  return null
}

// Эффективная дата отсчёта графика ухода. Для многолетников (is_perennial) график считается
// от начала ТЕКУЩЕГО сезона, а не от давней даты посадки: если посадке больше ~330 дней,
// прибавляем целые годы, пока дата не попадёт в последние 12 месяцев. Так клубника, заведённая
// год назад, получает задачи этого сезона, а не «лавину» пропущенных за прошлые годы.
function effectivePlantedAt(plantedAt, isPerennial, today) {
  if (!isPerennial) return plantedAt
  const p = new Date(plantedAt)
  // Посадка моложе года — отсчёт от реальной даты.
  if (today - p < 365 * 86400000) return p
  // Иначе — годовщина посадки (тот же месяц/день) в текущем сезоне.
  const anniv = new Date(p)
  anniv.setFullYear(today.getFullYear())
  // Если годовщина этого года ещё далеко впереди — берём прошлогоднюю (последнюю наступившую).
  if (anniv - today > 31 * 86400000) anniv.setFullYear(today.getFullYear() - 1)
  return anniv
}

// Интервал полива с учётом условий. Теплица → поливать ЧАЩЕ: без дождя и ветрового испарения
// снаружи грунт под укрытием прогревается и пересыхает быстрее, поэтому интервал КОРОЧЕ (×0.8).
// Единая функция-источник правды для today.js, careRemindersJob.js и Android (CalendarViewModel).
const GREENHOUSE_WATERING_FACTOR = 0.8
function wateringIntervalDays(freqDays, conditions) {
  const base = freqDays || 3
  const factor = conditions === 'greenhouse' ? GREENHOUSE_WATERING_FACTOR : 1
  return Math.max(1, Math.round(base * factor))
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
function getOverdueCareTask(careTasks, plantedAt, today, harvestDays, lastCareDone = {}, todayActions = [], isPerennial = false) {
  if (!careTasks || careTasks.length === 0) return null
  const limit = harvestDays || 180
  const eff = effectivePlantedAt(plantedAt, isPerennial, today)
  const daysSincePlanting = Math.floor((today - eff) / 86400000)
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

    const daysOverdue = daysSincePlanting - dueOffset
    if (daysOverdue > OVERDUE_WINDOW_DAYS) continue // слишком старое — не показываем

    const mappedAction = careTaskActionType(task.name)
    const dueDate = new Date(eff.getTime() + dueOffset * 86400000)
    const lastDone = mappedAction ? lastCareDone[mappedAction] : null
    const doneSinceDue = lastDone && new Date(lastDone) >= dueDate
    const doneToday = mappedAction && todayActions.includes(mappedAction)
    if (doneSinceDue || doneToday) continue

    if (!best || daysOverdue > best.days_overdue) {
      best = { name: task.name, days_overdue: daysOverdue, product: CARE_TASK_PRODUCT[task.name] || null }
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
    // Для многолетников отсчёт ухода — от текущего сезона (см. effectivePlantedAt).
    const plantedAt = effectivePlantedAt(new Date(p.planted_at), p.is_perennial, today)
    const daysSincePlanting = Math.floor((today - plantedAt) / 86400000)

    // 🚨 Угроза заморозков (теплица защищает — для greenhouse алерт не показываем)
    if (p.frost_sensitive && p.conditions !== 'greenhouse' && weather && weather.frost_risk === true) {
      tasks.push({
        type: 'frost_alert',
        priority: TASK_PRIORITY.frost_alert,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `Угроза заморозков! Защитите ${p.crop_name}`,
      })
    }

    // 🌱 Пора пересаживать в грунт — только для рассадного способа (sowing_method='seedling').
    // Прямой посев ('direct') в грунт не пересаживают.
    const todayActions = careActionsToday[p.id] || []
    if (
      p.transplant_days &&
      p.sowing_method !== 'direct' &&
      daysSincePlanting >= p.transplant_days &&
      daysSincePlanting - p.transplant_days <= OVERDUE_WINDOW_DAYS &&
      p.stage === 'sowing' &&
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
      if (daysSincePlanting - dueOffset > OVERDUE_WINDOW_DAYS) continue // слишком старое

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
        product: CARE_TASK_PRODUCT[task.name] || null,
        message: `${p.crop_name}: ${task.name} — ${when}`,
        days_overdue: diff < 0 ? -diff : 0,
      })
    }

    // 💧 Нужен полив (пропускаем если ожидается дождь ≥70%)
    if (p.watering_freq_days && !rainExpected) {
      const lastWatered = lastWateredMap[p.id] || plantedAt
      const daysSinceWatering = Math.floor((today - lastWatered) / 86400000)
      const freq = wateringIntervalDays(p.watering_freq_days, p.conditions)
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

    // 🌿 Нужна подкормка (по fertilizing_schedule для текущей стадии).
    // После высадки стадия 'transplanted' соответствует фазе 'growing' (так размечен график подкормок).
    const fertilizingSchedule = p.fertilizing_schedule || []
    const fertStage = p.stage === 'transplanted' ? 'growing' : p.stage
    const fertEntry = fertilizingSchedule.find(f => f.stage === fertStage)
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

    // 🌾 Пора убирать урожай.
    // Прямой посев растёт в грунте с момента посева (стадия остаётся 'sowing'), поэтому для него
    // урожай считаем по harvest_days напрямую; рассадные — после высадки (growing/transplanted/…).
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      (p.sowing_method === 'direct' || ['growing', 'flowering', 'harvesting', 'transplanted'].includes(p.stage))
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
        product: CARE_TASK_PRODUCT[name] || null,
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
      product: t.product || null,
    }
  })
}

module.exports = { buildTasks, formatTasks, getNextCareTask, getOverdueCareTask, careTaskActionType, wateringIntervalDays, effectivePlantedAt, CARE_ACTION_TYPES, OVERDUE_WINDOW_DAYS }
