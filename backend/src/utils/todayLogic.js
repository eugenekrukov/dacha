'use strict'

// Care-action_type'ы, которыми Android закрывает care-задачи. Этот же список —
// в SQL-фильтрах today.js / plantings.js (lastCareActionMap, careActionsToday).
const CARE_ACTION_TYPES = ['tying', 'pinching', 'hilling', 'pruning', 'weeding', 'loosening', 'treatment',
  'thinning', 'runner_removal', 'bolt_removal', 'deflowering', 'staking', 'fertilizing']

// Окно давности: care-задачи и пересадку, просроченные больше этого срока, не показываем —
// иначе посадка с датой год назад выдаёт «лавину» давно пропущенных задач (см. effectivePlantedAt).
const OVERDUE_WINDOW_DAYS = 21

// Сколько дней не повторять harvest_due после лога в harvests — иначе многоразовые культуры
// (огурцы, малина) получали бы карточку каждый день сразу после очередного сбора.
const HARVEST_COOLDOWN_DAYS = 3

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

// Подсказка «как делать» для care-задач без погодной зависимости (в отличие от treatment —
// см. hint ниже). Ключ = action_type из careTaskActionType(), общая для всех культур (культура
// уже названа в заголовке карточки). 'fertilizing' сюда не входит — подкормку care_tasks
// на практике не используют (для неё отдельный тип задачи fertilizing_due).
const CARE_TASK_HINTS = {
  pinching:       'Обрывайте рано утром — срез подсохнет за день, меньше риск инфекции',
  hilling:        'После полива или дождя, по влажной земле — сухая осыпается',
  tying:          'Свободной петлёй восьмёркой — тугой узел передавит стебель по мере роста',
  thinning:       'Оставляйте самое крепкое растение, остальные срезайте у земли — не выдёргивайте, повредите соседние корни',
  staking:        'Ставьте у корня сразу, не когда растение уже полегло',
  bolt_removal:   'Срезайте сразу — иначе растение уходит в семена',
  runner_removal: 'У самого основания — иначе тянут силы от урожая',
  deflowering:    'Стимулирует новое цветение',
  pruning:        'Чистым секатором, срезанное убирайте с грядки',
  loosening:      'После полива или дождя, пока верхний слой не заветрел',
  weeding:        'Пока сорняки маленькие — у переросших корни уже переплелись с культурой',
}

const TRANSPLANT_HINT = 'Полейте лунку перед посадкой — рассада быстрее приживётся'

function careTaskActionType(name) {
  if (!name) return null
  const n = name.toLowerCase()
  if (n.includes('подкормк') || n.includes('удобрен')) return 'fertilizing'
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

// Срок до урожая с учётом сорта: переопределение сорта (variety_harvest_days из JOIN
// crop_varieties) перекрывает срок культуры. Один хелпер на все пять точек, где
// используется harvest_days (plantings.js, today.js, recommendations.js) — иначе
// переопределение сорта работало бы в календаре, но не в «Сегодня»/рекомендациях.
function effectiveHarvestDays(row) {
  return row.variety_harvest_days ?? row.harvest_days
}

// День года (1 = 1 января) → Date указанного года. Через setDate, поэтому високосный
// год учитывается сам: setDate(60) в 2028-м даст 29 февраля, а не 1 марта.
function dateFromDoy(doy, year) {
  const d = new Date(year, 0, 1)
  d.setDate(doy)
  d.setHours(0, 0, 0, 0)
  return d
}

// Начало сезона ухода (день года) для культуры в зоне участка. Берём из уже существующих
// и уже зонированных данных crops.climate_zones[зона].transplant_start; зона участка —
// gardens.climate_zone. Нет данных → null (тогда работает прежний якорь-годовщина).
// Начало сезона ухода (день года) по климатической зоне USDA.
//
// Это свойство КЛИМАТА, а не культуры: различия между растениями уже сидят в day_offset
// внутри сезона. Поэтому одна таблица на зону, а не поле у каждой культуры.
//
// НЕ путать с crops.climate_zones[зона].transplant_start — то окно ПОСАДКИ саженца, оно про
// другое: у жимолости оно сентябрьское (244), и уход по нему стартовал бы осенью, а
// «Весенняя обрезка» попадала бы на 11 сентября.
//
// Значения — устойчивый переход среднесуточной температуры через +5 °C (стандартное
// агрометеорологическое определение начала вегетации), посчитанный по архиву Open-Meteo
// за 2021–2026 для опорных городов каждой зоны тем же алгоритмом, что в seasonService
// (центрированное 7-дневное сглаживание):
//   зона 3 — Новосибирск (108), Красноярск (111), Иркутск (110), Чита (119)
//   зона 4 — Омск (101), Екатеринбург (99), Пермь (107), Челябинск (98), Тюмень (98)
//   зона 5 — Москва (89), Воронеж (83), Саратов (86)
//   зона 6 — Краснодар (70), Ростов-на-Дону (76)
// Это НОРМА. Разброс по годам достигает трёх недель (Новосибирск: 94…115), поэтому по
// факту весну уточняет seasonService по архиву погоды участка — таблица остаётся фолбэком.
const SEASON_START_DOY = { '3': 112, '4': 101, '5': 86, '6': 73 }
const DEFAULT_SEASON_START_DOY = SEASON_START_DOY['5']

// Конец вегетации — переход НИЖЕ +5 °C, тем же методом и по тем же городам:
//   зона 3 — 4 окт · зона 4 — 5 окт · зона 5 — 31 окт · зона 6 — 22 ноя
// Длина сезона отсюда: 168 / 176 / 218 / 252 дня. Именно этот разброс (84 дня) и делает
// невозможной привязку осенних работ к весне — см. taskDayOffset.
const SEASON_END_DOY = { '3': 277, '4': 278, '5': 304, '6': 326 }
const DEFAULT_SEASON_END_DOY = SEASON_END_DOY['5']

function seasonStartDoy(climateZone) {
  if (climateZone == null) return null
  return SEASON_START_DOY[String(climateZone)] ?? DEFAULT_SEASON_START_DOY
}

function seasonEndDoy(climateZone) {
  if (climateZone == null) return null
  return SEASON_END_DOY[String(climateZone)] ?? DEFAULT_SEASON_END_DOY
}

// День года для произвольной даты (инверсия dateFromDoy).
function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

// Сдвиг календарного окна под зону участка: используем ту же дельту, что и для начала
// сезона (SEASON_START_DOY) — окна созревания заданы «для зоны 5», задел под региональную
// калибровку без отдельной таблицы на каждую культуру (см. риски плана 2026-08-17-crop-varieties.md).
function zoneDoyShift(climateZone) {
  if (climateZone == null) return 0
  return seasonStartDoy(climateZone) - DEFAULT_SEASON_START_DOY
}

// Окно съёма многолетника (ягода/плодовое дерево): сорт (variety_harvest_doy_*) перекрывает
// окно культуры, как effectiveHarvestDays — сорт для harvest_days. row.harvest_doy_end
// отсутствует → одна дата (start=end).
function effectiveHarvestWindow(row) {
  const start = row.variety_harvest_doy_start ?? row.harvest_doy_start
  if (start == null) return null
  const end = row.variety_harvest_doy_end ?? row.harvest_doy_end ?? start
  return { start, end }
}

// Ближайшая дата окна съёма (для expected_harvest_at — календарям нужна одна дата, не диапазон).
// Если окно этого года уже закрылось — берём следующий год (тот же приём, что effectivePlantedAt).
function nextHarvestWindowDate(window, climateZone, today) {
  if (!window) return null
  const shift = zoneDoyShift(climateZone)
  const year = today.getFullYear()
  const start = dateFromDoy(window.start + shift, year)
  const end = dateFromDoy(window.end + shift, year)
  if (end < today) return dateFromDoy(window.start + shift, year + 1)
  return start
}

/**
 * Смещение задачи в днях ОТ НАЧАЛА сезона.
 *
 * Осенние работы (anchor: "end") заданы относительно конца вегетации: «Осенняя обрезка»
 * это «через 7 дней после листопада», а не «через 120 дней после схода снега». Приводим
 * их к отсчёту от начала — дальше вся арифметика расписаний работает без изменений.
 *
 * seasonLength не известна (нет данных по зоне) → задача остаётся привязанной к началу:
 * хуже по точности, но лучше, чем не показать её вовсе.
 */
function taskDayOffset(task, seasonLength) {
  if (task.anchor !== 'end' || !seasonLength) return task.day_offset
  return seasonLength + task.day_offset
}

// Эффективная дата отсчёта графика ухода для многолетников (is_perennial).
//
// Уход у многолетника привязан к КАЛЕНДАРЮ, а не к дате посадки: смородину обрезают весной
// независимо от того, посадили её в октябре или в мае. Поэтому якорь — начало сезона ухода
// в зоне участка (seasonStart, день года), а не годовщина посадки. Раньше считали от
// годовщины, и у осенней посадки «Весенняя обрезка» уезжала в октябрь, а «Осенняя» — в февраль.
//
// seasonStart отсутствует (нет зоны участка или climate_zones у культуры) → фолбэк на прежнее
// поведение: годовщина посадки в текущем сезоне. Хуже календаря, но лучше даты трёхлетней давности.
//
// ВНИМАНИЕ: якорь может оказаться РАНЬШЕ даты посадки (куст завели в середине сезона).
// Это намеренно — так у него остаётся текущий уход (прополка и т.п.); задачи, выпавшие
// до самой посадки, отсекаются отдельно по plantedAt там, где строится список.
function effectivePlantedAt(plantedAt, isPerennial, today, seasonStart = null) {
  if (!isPerennial) return plantedAt
  const p = new Date(plantedAt)

  if (seasonStart) {
    let anchor = dateFromDoy(seasonStart, today.getFullYear())
    // Сезон этого года ещё далеко впереди — значит идёт прошлогодний (та же логика, что у годовщины).
    if (anchor - today > 31 * 86400000) anchor = dateFromDoy(seasonStart, today.getFullYear() - 1)
    return anchor
  }

  // Посадка моложе года — отсчёт от реальной даты.
  if (today - p < 365 * 86400000) return p
  // Иначе — годовщина посадки (тот же месяц/день) в текущем сезоне.
  const anniv = new Date(p)
  anniv.setFullYear(today.getFullYear())
  // Если годовщина этого года ещё далеко впереди — берём прошлогоднюю (последнюю наступившую).
  if (anniv - today > 31 * 86400000) anniv.setFullYear(today.getFullYear() - 1)
  return anniv
}

// pg отдаёт numeric-колонки строками ('22.5'), а weather приходит в buildTasks сырой строкой
// БД — без приведения все сравнения с порогами молча ломались бы на строках.
function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// Интервал полива с учётом условий. Теплица → поливать ЧАЩЕ: без дождя и ветрового испарения
// снаружи грунт под укрытием прогревается и пересыхает быстрее, поэтому интервал КОРОЧЕ (×0.8).
// Единая функция-источник правды для today.js, careRemindersJob.js и Android (CalendarViewModel).
const GREENHOUSE_WATERING_FACTOR = 0.8

// Испарение: в жару, в сухом воздухе и на ветру грунт пересыхает быстрее — интервал короче.
// Это не модель эвапотранспирации, а калибровочные ручки под среднюю полосу: пороги и
// множители правятся по фидбеку дачников, поэтому вынесены константами.
const HEAT_WATERING_FACTORS = [
  { fromTempC: 30, factor: 0.6 },
  { fromTempC: 26, factor: 0.75 },
  { fromTempC: 22, factor: 0.9 },
]
const DRY_AIR_HUMIDITY_PCT = 40
const DRY_AIR_FACTOR       = 0.9
const WINDY_MS             = 6
const WINDY_FACTOR         = 0.9
// Нижняя граница: даже при жаре+ветре+сухости не сокращаем интервал больше чем вдвое.
const MIN_WATERING_FACTOR  = 0.5
// С этой температуры полив уводим на вечер (днём вода обжигает лист и испаряется впустую).
const HOT_DAY_TEMP_C       = 28

function wateringIntervalDays(freqDays, conditions, weather = null) {
  const base = freqDays || 3
  const greenhouse = conditions === 'greenhouse'
  let factor = greenhouse ? GREENHOUSE_WATERING_FACTOR : 1

  const maxTemp = num(weather?.max_temp_c)
  if (maxTemp !== null) {
    const hit = HEAT_WATERING_FACTORS.find(h => maxTemp >= h.fromTempC)
    if (hit) factor *= hit.factor
  }
  const humidity = num(weather?.humidity_pct)
  if (humidity !== null && humidity < DRY_AIR_HUMIDITY_PCT) factor *= DRY_AIR_FACTOR
  // Ветер сушит только открытый грунт — под укрытием испарение от него не зависит.
  const wind = num(weather?.wind_ms)
  if (!greenhouse && wind !== null && wind >= WINDY_MS) factor *= WINDY_FACTOR

  return Math.max(1, Math.round(base * Math.max(factor, MIN_WATERING_FACTOR)))
}

// Стадии посадки → ключи watering_details (в справочнике культур своя номенклатура).
// Зеркалит маппинг подкормок в buildTasks (transplanted → growing).
const WATERING_STAGE_ALIAS = { sowing: 'seedling', transplanted: 'growing', harvesting: 'fruiting' }

// Норма и частота полива для текущей стадии из crops.watering_details
// ({"growing":{"freq_days":3,"amount_l_m2":6}, ...}). Нет данных по стадии → null,
// тогда работает общий watering_freq_days культуры.
function stageWatering(wateringDetails, stage) {
  if (!wateringDetails || !stage) return null
  const entry = wateringDetails[WATERING_STAGE_ALIAS[stage] || stage]
  return entry && typeof entry === 'object' ? entry : null
}

// Дождь засчитываем вместо полива и отменяем им задачу только если это настоящий пролив,
// а не морось: нужны И высокая вероятность, И заметный объём. Одна вероятность врёт —
// 70% на 0.2 мм это не полив.
const RAIN_SKIP_PROB_PCT = 70
const RAIN_SKIP_MM       = 3
// Сколько миллиметров считаем полноценным поливом (для зачёта уже прошедшего дождя).
const RAIN_AS_WATERING_MM = 5

function isRainyDay(day) {
  if (!day) return false
  const prob = num(day.precip_prob_pct)
  const mm   = num(day.precip_mm)
  return prob !== null && prob >= RAIN_SKIP_PROB_PCT && mm !== null && mm >= RAIN_SKIP_MM
}

// Ждать ли дождя сегодня/завтра. Основной источник — forecast_json (вероятность И объём);
// если прогноза нет (старый снимок) — фолбэк на голую вероятность из снимка.
function rainOutlook(weather, precipProb = null) {
  const forecast = weather?.forecast_json
  if (Array.isArray(forecast) && forecast.length) {
    return { today: isRainyDay(forecast[0]), tomorrow: isRainyDay(forecast[1]) }
  }
  const prob = num(precipProb)
  return { today: prob !== null && prob >= RAIN_SKIP_PROB_PCT, tomorrow: false }
}

// Заморозок сегодня — из снимка; на завтра/послезавтра — из прогноза, чтобы успеть укрыть
// (сообщить в день заморозка почти бесполезно). Порог совпадает с frost_risk в weatherService.
const FROST_MIN_TEMP_C = 2
const FROST_LOOKAHEAD_DAYS = 2

function frostOutlook(weather) {
  if (!weather) return null
  if (weather.frost_risk === true) return { days_until: 0, min_temp_c: num(weather.min_temp_c) }
  const forecast = weather.forecast_json
  if (!Array.isArray(forecast)) return null
  for (let i = 1; i <= FROST_LOOKAHEAD_DAYS; i++) {
    const min = num(forecast[i]?.min_temp_c)
    if (min !== null && min <= FROST_MIN_TEMP_C) return { days_until: i, min_temp_c: min }
  }
  return null
}

/**
 * Единый расчёт полива: интервал (стадия + теплица + испарение), зачёт прошедшего дождя
 * вместо полива и отмена по прогнозу. Источник правды для GET /today и careRemindersJob —
 * иначе пуш в 09:00 зовёт поливать под дождём, а экран «Сегодня» задачу уже не показывает.
 *
 * @param lastWateredAt — Date последнего полива (или дата посадки, если не поливали)
 * @param lastRainAt    — Date последнего настоящего дождя (>= RAIN_AS_WATERING_MM) или null
 */
function wateringStatus(p, weather, lastWateredAt, lastRainAt, today, rain = null) {
  const stageEntry = stageWatering(p.watering_details, p.stage)
  const baseFreq = num(stageEntry?.freq_days) ?? p.watering_freq_days
  if (!baseFreq) return { due: false }

  const outdoor = p.conditions !== 'greenhouse'
  // Ливень — это полив: без зачёта приложение после 20 мм осадков продолжает требовать
  // «полить, 5 дн. без воды». В теплицу дождь не попадает, там зачёта нет.
  let last = lastWateredAt
  if (outdoor && lastRainAt && lastRainAt > last) last = lastRainAt

  const daysSinceWatering = Math.floor((today - last) / 86400000)
  const freq = wateringIntervalDays(baseFreq, p.conditions, weather)
  const overdue = daysSinceWatering - freq
  const outlook = rain || rainOutlook(weather)
  // Дождь отменяет полив только в открытом грунте. Завтрашний — только если посадка ещё
  // не просрочена: пересохшей грядке ждать сутки нельзя.
  const rainSkip = outdoor && (outlook.today || (outlook.tomorrow && overdue <= 0))

  return {
    due: daysSinceWatering >= freq && !rainSkip,
    freq,
    days_since_watering: daysSinceWatering,
    days_overdue: Math.max(overdue, 0),
    amount_l_m2: num(stageEntry?.amount_l_m2),
  }
}

// «Когда» и «сколько» — детали, которых карточке полива не хватало.
function wateringHint(weather, status) {
  const parts = []
  if (status.amount_l_m2) parts.push(`~${status.amount_l_m2} л/м²`)
  const maxTemp = num(weather?.max_temp_c)
  if (maxTemp !== null && maxTemp >= HOT_DAY_TEMP_C) parts.push('в жару — после 19:00, под корень')
  return parts.join(' · ') || null
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

// Длина текущего сезона многолетника в днях (365 или 366) — от годовщины посадки до
// следующей. Считаем календарно, а не константой 365: иначе в високосный год «через N дн.»
// на карточке разъезжается с датой в расписании работ.
function seasonLengthDays(anchor) {
  const next = new Date(anchor)
  next.setFullYear(anchor.getFullYear() + 1)
  return Math.round((next - anchor) / 86400000)
}

/**
 * Вычисляет ближайшую дату наступления care_task для посадки.
 * Используется в GET /plantings для поля next_care_task.
 *
 * @param seasonDays — длина сезона многолетника (seasonLengthDays), иначе null.
 *   Уход у многолетника цикличен по годам: если все задачи ТЕКУЩЕГО сезона уже прошли
 *   (осенняя посадка, смотрим летом → daysSincePlanting ~300 при limit 180), берём первое
 *   наступление в СЛЕДУЮЩЕМ сезоне. Без этого карточка молчала до самой годовщины.
 */
function getNextCareTask(careTasks, daysSincePlanting, harvestDays, seasonDays = null, seasonLength = null) {
  if (!careTasks || careTasks.length === 0) return null
  const limit = harvestDays || 180
  let nextTask = null
  let nextDays = Infinity

  const consider = (name, daysUntil) => {
    if (daysUntil < nextDays) {
      nextDays = daysUntil
      nextTask = { name, days_until: daysUntil }
    }
  }

  for (const task of careTasks) {
    // Осенние задачи заданы от конца вегетации — приводим к отсчёту от начала.
    const baseOffset = taskDayOffset(task, seasonLength)
    // Ближайшее наступление в текущем сезоне (null — все уже прошли).
    let occurrence = null
    if (!task.repeat_days) {
      // Разовая задача не зависит от limit — у неё ровно одна дата, и у многолетников
      // смещение бывает больше лимита (осенняя обрезка). Зеркало buildSchedule.
      if (baseOffset > daysSincePlanting) occurrence = baseOffset
    } else {
      let offset = baseOffset
      while (offset <= limit) {
        if (offset > daysSincePlanting) { occurrence = offset; break }
        offset += task.repeat_days
      }
    }

    if (occurrence !== null) consider(task.name, occurrence - daysSincePlanting)
    else if (seasonDays) consider(task.name, seasonDays + baseOffset - daysSincePlanting)
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
function getOverdueCareTask(careTasks, plantedAt, today, harvestDays, lastCareDone = {}, todayActions = [], isPerennial = false, seasonStart = null, seasonLength = null, createdAt = null) {
  if (!careTasks || careTasks.length === 0) return null
  const limit = harvestDays || 180
  const eff = effectivePlantedAt(plantedAt, isPerennial, today, seasonStart)
  const daysSincePlanting = Math.floor((today - eff) / 86400000)
  // Якорь сезона может быть раньше посадки (куст завели в середине сезона) — задачи
  // до самой посадки не показываем: их физически нельзя было выполнить. Аналогично для
  // ретро-посадок — не показываем как «просроченное» то, что было раньше добавления
  // посадки в приложение (см. тот же фильтр в buildSchedule/GET actions).
  const realPlantedAt = new Date(plantedAt)
  const floor = createdAt && createdAt > realPlantedAt ? createdAt : realPlantedAt
  let best = null

  for (const task of careTasks) {
    // Осенние задачи заданы от конца вегетации — приводим к отсчёту от начала.
    const baseOffset = taskDayOffset(task, seasonLength)
    // Последняя наступившая дата задачи (<= сегодня)
    let dueOffset = null
    if (!task.repeat_days) {
      // Разовая задача: одна дата, limit её не ограничивает (см. buildTasks).
      if (baseOffset <= daysSincePlanting) dueOffset = baseOffset
    } else {
      let offset = baseOffset
      while (offset <= limit && offset <= daysSincePlanting) {
        dueOffset = offset
        offset += task.repeat_days
      }
    }
    if (dueOffset === null) continue // ещё не наступила

    const daysOverdue = daysSincePlanting - dueOffset
    if (daysOverdue > OVERDUE_WINDOW_DAYS) continue // слишком старое — не показываем

    const mappedAction = careTaskActionType(task.name)
    const dueDate = new Date(eff.getTime() + dueOffset * 86400000)
    if (dueDate < floor) continue // до посадки или до добавления в приложение — нельзя было выполнить
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

// Группирует однотипные задачи (полив/подкормка) в одну информационную карточку с мульти-листом.
// Одиночные пушатся как есть (адресные). Группа теряет per-planting product (у культур разные),
// поэтому заголовок/описание формируются formatTasks по crops, без конкретного препарата.
function pushGrouped(tasks, accum, type) {
  if (accum.length === 0) return
  if (accum.length === 1) { tasks.push(accum[0]); return }
  const crops = accum.map(g => g.crop_name)
  // Подсказка группы — только та, что верна для всех культур (норма л/м² у каждой своя).
  const hints = new Set(accum.map(g => g.hint || ''))
  tasks.push({
    type,
    priority: accum[0].priority,
    planting_id: null,
    crop_name: null,
    crops,
    hint: hints.size === 1 ? (accum[0].hint || null) : null,
    planting_ids: accum.map(g => g.planting_id),
    crop_names_with_ids: accum.map(g => ({ id: g.planting_id, name: g.crop_name })),
    days_overdue: Math.max(...accum.map(g => g.days_overdue || 0)),
  })
}

function buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminders, today = new Date(), careActionsToday = {}, precipProb = null, lastCareActionMap = {}, lastHarvestedMap = {}, opts = {}) {
  // climateZone — зона участка (gardens.climate_zone). Нужна, чтобы уход многолетников
  // считался от начала сезона в этой зоне, а не от годовщины посадки (см. effectivePlantedAt).
  // seasonStart можно передать готовым (погодная поправка по участку) — иначе берём по зоне.
  const { lastRainAt = null, climateZone = null, seasonStart = null, seasonEnd = null } = opts
  const gardenSeasonStart = seasonStart ?? seasonStartDoy(climateZone)
  const gardenSeasonEnd = seasonEnd ?? seasonEndDoy(climateZone)
  // Длина сезона — чтобы перевести осенние задачи (anchor:"end") в отсчёт от начала.
  const seasonLength = gardenSeasonStart && gardenSeasonEnd ? gardenSeasonEnd - gardenSeasonStart : null
  const rain = rainOutlook(weather, precipProb)
  const frost = frostOutlook(weather)
  const tasks = []
  const careAccum = [] // care-задачи копим отдельно — потом группируем однотипные
  const waterAccum = [] // полив — тоже группируем (одна карточка «Полить: …» на много посадок)
  const fertAccum = []  // подкормка — аналогично

  for (const p of plantings) {
    // Для многолетников отсчёт ухода — от начала сезона в зоне участка (см. effectivePlantedAt).
    const plantedAt = effectivePlantedAt(new Date(p.planted_at), p.is_perennial, today, gardenSeasonStart)
    const daysSincePlanting = Math.floor((today - plantedAt) / 86400000)
    // Якорь сезона бывает раньше посадки — задачи до неё не показываем (см. effectivePlantedAt).
    // Аналогично для ретро-посадок: задачи раньше момента добавления в приложение не могли
    // быть выполнены (тот же фильтр, что в buildSchedule/GET actions).
    const realPlantedAt = new Date(p.planted_at)
    const createdAt = p.created_at ? new Date(p.created_at) : null
    const careFloor = createdAt && createdAt > realPlantedAt ? createdAt : realPlantedAt

    // 🚨 Угроза заморозков (теплица защищает — для greenhouse алерт не показываем).
    // Предупреждаем и на завтра/послезавтра: укрытие нужно готовить заранее.
    if (p.frost_sensitive && p.conditions !== 'greenhouse' && frost) {
      const t = frost.min_temp_c !== null ? ` (${Math.round(frost.min_temp_c)}°C)` : ''
      const message = frost.days_until === 0
        ? `Угроза заморозков! Защитите ${p.crop_name}`
        : frost.days_until === 1
          ? `Заморозки завтра ночью${t} — укройте ${p.crop_name}`
          : `Заморозки через ${frost.days_until} дн.${t} — подготовьте укрытие для ${p.crop_name}`
      tasks.push({
        type: 'frost_alert',
        priority: TASK_PRIORITY.frost_alert,
        planting_id: p.id,
        crop_name: p.crop_name,
        days_until: frost.days_until,
        min_temp_c: frost.min_temp_c,
        message,
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
        hint: TRANSPLANT_HINT,
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
      // Осенние задачи заданы от конца вегетации — приводим к отсчёту от начала.
      const baseOffset = taskDayOffset(task, seasonLength)
      // Находим последнюю наступившую (или близкую, до +3 дней) дату задачи
      let dueOffset = null
      if (!task.repeat_days) {
        // Разовая задача: ровно одна дата, careLimit её не ограничивает — осенние работы
        // выходят за harvest_days, а прежний лимит просто прятал их с экрана.
        if (baseOffset <= daysSincePlanting + 3) dueOffset = baseOffset
      } else {
        let offset = baseOffset
        while (offset <= careLimit && offset <= daysSincePlanting + 3) {
          dueOffset = offset
          offset += task.repeat_days
        }
      }
      if (dueOffset === null) continue // ещё не наступила
      if (daysSincePlanting - dueOffset > OVERDUE_WINDOW_DAYS) continue // слишком старое

      const key = `${p.id}:${task.name}`
      if (addedCareNames.has(key)) continue

      const mappedAction = careTaskActionType(task.name)
      const dueDate = new Date(plantedAt.getTime() + dueOffset * 86400000)
      if (dueDate < careFloor) continue // до посадки или до добавления в приложение — нельзя было выполнить
      const lastDone = mappedAction ? lastCareDone[mappedAction] : null
      const doneSinceDue = lastDone && new Date(lastDone) >= dueDate
      const doneToday = mappedAction && todayActions.includes(mappedAction)
      if (doneSinceDue || doneToday) continue

      addedCareNames.add(key)
      const diff = dueOffset - daysSincePlanting // <= 3; отрицательный = просрочено
      const when = diff <= 0 ? 'сегодня' : `через ${diff} дн.`
      // Опрыскивание перед дождём бессмысленно — препарат смоет; и никогда не по солнцу.
      // Остальные типы (окучивание/подвязка/прищипка и т.д.) — статичная подсказка «как делать»,
      // без погодной логики (см. CARE_TASK_HINTS).
      const hint = mappedAction === 'treatment'
        ? (rain.today || rain.tomorrow
            ? 'Ожидается дождь — перенесите, иначе смоет'
            : 'Не по солнцу — утром или вечером')
        : CARE_TASK_HINTS[mappedAction] || null
      careAccum.push({
        hint,
        type: 'care_task_due',
        priority: TASK_PRIORITY.care_task_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        care_task_name: task.name,
        product: CARE_TASK_PRODUCT[task.name] || null,
        message: `${p.crop_name}: ${task.name} — ${when}`,
        days_overdue: diff < 0 ? -diff : 0,
        // Будущая задача (показана с +3-дневным опережением): сколько дней до наступления.
        // Нужен, чтобы «Сегодня» писал «через N дн.», а не «Сделайте сегодня» (согласовано
        // с next_care_task на карточке посадки — иначе экраны расходятся).
        days_until: diff > 0 ? diff : 0,
      })
    }

    // 💧 Нужен полив — единый расчёт с пушами (дождь, испарение, стадия): wateringStatus.
    const water = wateringStatus(p, weather, lastWateredMap[p.id] || plantedAt, lastRainAt, today, rain)
    if (water.due) {
      waterAccum.push({
        type: 'watering_due',
        priority: TASK_PRIORITY.watering_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — нужен полив (${water.days_since_watering} дн. без воды)`,
        days_overdue: water.days_overdue,
        hint: wateringHint(weather, water),
      })
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
        fertAccum.push({
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
    // После лога в harvests — не повторяем карточку HARVEST_COOLDOWN_DAYS дней.
    const lastHarvested = lastHarvestedMap[p.id]
    const daysSinceHarvest = lastHarvested ? Math.floor((today - lastHarvested) / 86400000) : Infinity
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      daysSinceHarvest >= HARVEST_COOLDOWN_DAYS &&
      (p.sowing_method === 'direct' || ['growing', 'flowering', 'harvesting', 'transplanted'].includes(p.stage))
    ) {
      tasks.push({
        type: 'harvest_due',
        priority: TASK_PRIORITY.harvest_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора убирать урожай!`,
      })
    } else if (!p.harvest_days && p.is_perennial) {
      // Многолетники (ягодные кусты, плодовые деревья): нет harvest_days — урожай приходит
      // в календарное окно, а не через N дней от посадки (см. effectiveHarvestWindow).
      const window = effectiveHarvestWindow(p)
      if (window) {
        const shift = zoneDoyShift(climateZone)
        const todayDoy = dayOfYear(today)
        if (todayDoy >= window.start + shift && todayDoy <= window.end + shift && daysSinceHarvest >= HARVEST_COOLDOWN_DAYS) {
          tasks.push({
            type: 'harvest_due',
            priority: TASK_PRIORITY.harvest_due,
            planting_id: p.id,
            crop_name: p.crop_name,
            message: `${p.crop_name} — пора убирать урожай!`,
          })
        }
      }
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
        hint: group[0].hint || null, // зависит от имени задачи и погоды → одинакова для всей группы
        crops,
        // Для мульти-посадочного действия: id всех посадок группы и пары {id, name},
        // чтобы клиент построил лист «снять/выполнить» по каждой культуре.
        planting_ids: group.map(g => g.planting_id),
        crop_names_with_ids: group.map(g => ({ id: g.planting_id, name: g.crop_name })),
        message: `${name}: ${listCrops(crops)}`,
        days_overdue: Math.max(...group.map(g => g.days_overdue || 0)),
        days_until: Math.min(...group.map(g => g.days_until || 0)),
      })
    }
  }

  // Полив и подкормка — самые частые задачи; на участке с десятком культур они забивают
  // список однотипными карточками. Группируем их в одну «Полить: …» / «Подкормить: …»
  // (как care-задачи): клиент открывает мульти-лист и снимает/выполняет по каждой культуре.
  // Одиночные остаются адресными (planting_id → tappable + детали на карточке посадки).
  pushGrouped(tasks, waterAccum, 'watering_due')
  pushGrouped(tasks, fertAccum, 'fertilizing_due')

  tasks.push(...reminders)

  tasks.sort((a, b) => {
    const d = urgency(a) - urgency(b)
    if (d !== 0) return d
    return (b.days_overdue || 0) - (a.days_overdue || 0)
  })

  return tasks
}

// Срочность = приоритет типа, смягчённый просрочкой. Голый приоритет типа врал: care-задача
// «через 3 дня» стояла выше полива, забытого на неделю. Потолок бонуса — 3 дня (≈1.5 ступени),
// чтобы давняя просрочка не выдавливала заморозки и пересадку из топа.
const OVERDUE_BONUS_PER_DAY  = 0.5
const OVERDUE_BONUS_CAP_DAYS = 3
function urgency(t) {
  // Ещё не наступившие задачи всегда ниже наступивших. Исключение — заморозки:
  // предупреждение «завтра ночью −1» ценно именно тем, что приходит заранее.
  if ((t.days_until || 0) > 0 && t.type !== 'frost_alert') return 100 + t.priority
  return t.priority - Math.min(t.days_overdue || 0, OVERDUE_BONUS_CAP_DAYS) * OVERDUE_BONUS_PER_DAY
}

// Ступень срочности для клиента. До этого пилюля просрочки была одного цвета на всё:
// на «Сегодня» одновременно горело 6+ одинаковых меток, и «полить сегодня» выглядело так же
// тревожно, как «прополка забыта две недели назад» — сигнал терялся весь сразу.
//
// Порог — неделя. Дачный цикл: полив раз в 2–4 дня, уход примерно раз в неделю; отстать
// на пару дней нормально и навёрстывается без последствий, больше недели — уже запущено.
//
// Проверено на живых данных (демо-участок, 2026-08-08): просрочки там 3, 4, 6, 7, 11, 13, 21 день.
// С порогом в 3 дня в «late» падало 6 задач из 7, и экран оставался сплошь красным — то есть
// градация не решала исходную проблему. С недельным порогом split честный: 3–7 дн. приглушённо,
// 11+ дн. красным.
//
// Значения: critical (заморозки — окно погоды, ждать нельзя) · late (просрочка > 7 дн.)
//           soon (просрочка 1–7 дн.) · normal (наступила сегодня или ещё предстоит).
const URGENCY_SOON_MAX_DAYS = 7
function urgencyLevel(t) {
  if (t.type === 'frost_alert') return 'critical'
  const overdue = t.days_overdue || 0
  if (overdue <= 0) return 'normal'
  return overdue <= URGENCY_SOON_MAX_DAYS ? 'soon' : 'late'
}

function formatTasks(tasks) {
  return tasks.map(t => {
    // Короткий actionable заголовок — помещается в одну строку карточки
    let title
    switch (t.type) {
      case 'watering_due':     title = (t.crops && t.crops.length)
                                 ? `Полить: ${listCrops(t.crops)}`
                                 : `Полить: ${t.crop_name}`; break
      case 'transplant_due':   title = `Высадить в грунт: ${t.crop_name}`; break
      case 'fertilizing_due':  title = (t.crops && t.crops.length)
                                 ? `Подкормить: ${listCrops(t.crops)}`
                                 : t.product_example ? `Подкормить ${t.crop_name} (${t.product_example})` : `Подкормить: ${t.crop_name}`; break
      case 'harvest_due':      title = `Убрать урожай: ${t.crop_name}`; break
      case 'frost_alert':      title = t.days_until > 0
                                 ? `Заморозки ${t.days_until === 1 ? 'завтра' : `через ${t.days_until} дн.`}: ${t.crop_name}`
                                 : `Заморозки: ${t.crop_name}`; break
      case 'care_task_due':    title = (t.crops && t.crops.length)
                                 ? `${t.care_task_name}: ${listCrops(t.crops)}`
                                 : `${t.care_task_name}: ${t.crop_name}`; break
      default:                 title = t.message || t.type
    }

    // Описание с деталями
    let description
    if (t.type === 'watering_due') {
      description = t.days_overdue > 0
        ? `Пора — задержка ${t.days_overdue} дн.`
        : 'Пора полить сегодня'
    } else if (t.type === 'transplant_due') {
      description = t.days_overdue > 0
        ? `Пора — задержка ${t.days_overdue} дн.`
        : 'Пора высаживать'
    } else if (t.type === 'harvest_due') {
      description = 'Урожай готов к сбору'
    } else if (t.type === 'fertilizing_due') {
      description = t.product_example
        ? `${t.product_example}`
        : t.days_overdue > 0 ? `Пора — задержка ${t.days_overdue} дн.` : 'Сделайте сегодня'
    } else if (t.type === 'frost_alert') {
      const temp = t.min_temp_c != null ? `${Math.round(t.min_temp_c)}°C ночью — ` : ''
      description = t.days_until > 0
        ? `${temp}подготовьте укрытие заранее`
        : `${temp}защитите растение от мороза`
    } else if (t.type === 'care_task_due') {
      description = t.days_overdue > 0
        ? `Пора — задержка ${t.days_overdue} дн.`
        : t.days_until > 0
          ? `Через ${t.days_until} дн.`
          : 'Сделайте сегодня'
    } else {
      description = t.crop_name ? `Культура: ${t.crop_name}` : ''
    }

    return {
      type: t.type,
      priority: t.priority,
      // Ступень срочности считает сервер, клиенты только красят (см. urgencyLevel).
      // Порог живёт в одном месте — иначе web и Android разъедутся, как было с careTaskActionType.
      urgency: urgencyLevel(t),
      title,
      description,
      // Подсказка «как делать/чем/когда» — отдельное поле (раньше дописывалась в description
      // через « · » одной строкой, из-за чего на узких экранах обрезалась вместе с ней).
      hint: t.hint || null,
      planting_id: t.planting_id || null,
      crop_name: t.crop_name || null,
      days_overdue: t.days_overdue || null,
      care_task_name: t.care_task_name || t.product_example || null,
      product: t.product || null,
      // Заморозки с упреждением остаются в «Сегодня» (укрытие готовят сейчас), поэтому
      // days_until для них не отдаём — срок уже в заголовке.
      days_until: t.type === 'frost_alert' ? null : (t.days_until || null),
      // Групповая care-задача: посадки для мульти-действия (одиночные → null).
      planting_ids: t.planting_ids || null,
      crop_names_with_ids: t.crop_names_with_ids || null,
    }
  })
}

// Ключ задачи дня для состояния «отложено/удалено» (today_task_dismissals) — зеркало Kotlin
// taskSnoozeKey(). Считается по УЖЕ отформатированной задаче: в formatTasks у care_task_name
// есть fallback на product_example, и именно эту строку клиент присылает обратно.
// null-поля дают литерал "null" (сгруппированные карточки: "watering_due:null:null:null").
function taskKey(t) {
  return `${t.type}:${t.planting_id}:${t.crop_name}:${t.care_task_name}`
}

// Сколько задач показываем на экране «Сегодня». Срез делает вызывающий (routes/today.js),
// чтобы отдать честное общее число: раньше tasks_total считался ПОСЛЕ среза и не мог быть > 7.
const TASK_LIMIT = 7

module.exports = {
  buildTasks, formatTasks, taskKey, getNextCareTask, getOverdueCareTask, careTaskActionType,
  effectiveHarvestDays, effectiveHarvestWindow, nextHarvestWindowDate, zoneDoyShift, dayOfYear,
  wateringIntervalDays, wateringStatus, rainOutlook, frostOutlook, effectivePlantedAt,
  seasonLengthDays, seasonStartDoy, seasonEndDoy, dateFromDoy, taskDayOffset,
  SEASON_START_DOY, SEASON_END_DOY,
  urgencyLevel,
  CARE_ACTION_TYPES, OVERDUE_WINDOW_DAYS, TASK_LIMIT, RAIN_AS_WATERING_MM,
  URGENCY_SOON_MAX_DAYS,
}
