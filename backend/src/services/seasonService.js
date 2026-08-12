'use strict'

// Фактическое начало сезона ухода по участку.
//
// Норма по климатической зоне (SEASON_START_DOY) — это среднее; реальная весна гуляет по
// годам на три недели (Новосибирск 2021–2026: день 91…112). Здесь определяем дату по
// фактической погоде участка: устойчивый переход среднесуточной температуры через +5 °C —
// стандартное агрометеорологическое определение начала вегетационного периода.
//
// Источник — архивный API Open-Meteo (тот же провайдер, что и прогноз в weatherService),
// ключей не требует. Считаем не чаще раза в год на участок: результат кладём в
// gardens.season_start_doy/season_start_year (миграция 067).

const THRESHOLD_C = 5
// Сглаживание: без него единичное похолодание в мае сдвигало бы дату на месяц.
const SMOOTH_DAYS = 7
// Анализируем с 1 марта. Не с февраля: на юге (Краснодар) февральская оттепель поднимает
// недельное среднее выше +5 °C, и «начало сезона» уезжало на 18 февраля при норме зоны 73.
// Это ложная весна, а не устойчивый переход. Тем же окном посчитана и норма SEASON_START_DOY —
// иначе факт и норма меряли бы разное.
const ANALYSIS_START_DOY = 60
const EARLIEST_DOY = ANALYSIS_START_DOY

function dayOfYear(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1
}

/**
 * День года устойчивого перехода через +5 °C, либо null если переход ещё не случился
 * (смотрим рано весной) или данных не хватает.
 *
 * Окно усреднения ЦЕНТРИРОВАННОЕ (±3 дня вокруг дня-кандидата). Сначала брали среднее
 * вперёд от кандидата — тогда возвращался день на 3–6 суток РАНЬШЕ реального потепления:
 * окно уже захватывало тёплый хвост, пока сам день был ещё морозным.
 */
const HALF = Math.floor(SMOOTH_DAYS / 2)
function transitionDoy(times, temps, rising = true) {
  const pts = []
  for (let i = 0; i < times.length; i++) {
    if (temps[i] != null) pts.push({ doy: dayOfYear(times[i]), t: temps[i] })
  }
  if (pts.length < SMOOTH_DAYS) return null
  for (let k = HALF; k < pts.length - HALF; k++) {
    let sum = 0
    for (let j = k - HALF; j <= k + HALF; j++) sum += pts[j].t
    const mean = sum / SMOOTH_DAYS
    if (rising ? mean >= THRESHOLD_C : mean < THRESHOLD_C) return pts[k].doy
  }
  return null
}

// Осень раньше этого дня не наступает ни в одной зоне (самая ранняя норма — 277, 4 октября),
// поэтому до него в архив за осенним переходом не ходим.
const AUTUMN_ATTEMPT_FROM_DOY = 270

async function fetchSeasonTemps(lat, lon, year, fetchFn = fetch) {
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}`
    + `&start_date=${year}-03-01&end_date=${year}-12-31`
    + '&daily=temperature_2m_mean&timezone=auto'
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`archive HTTP ${res.status}`)
  const json = await res.json()
  return json?.daily ?? null
}

// Ряд за год делим на весеннее (март–июль) и осеннее (август–декабрь) окна, чтобы
// подъём и спад искались каждый в своём: иначе спад нашёлся бы ещё в мартовских морозах.
function splitWindows(times, temps) {
  const spring = { time: [], temps: [] }
  const autumn = { time: [], temps: [] }
  for (let i = 0; i < times.length; i++) {
    const m = Number(times[i].slice(5, 7))
    const bucket = m >= 3 && m <= 7 ? spring : (m >= 8 ? autumn : null)
    if (bucket) { bucket.time.push(times[i]); bucket.temps.push(temps[i]) }
  }
  return { spring, autumn }
}

/**
 * Пересчитывает границы сезона участка. Возвращает { start, end } — дни года либо null
 * (тогда работает норма по зоне).
 *
 * Осень определима только после того, как она наступила, поэтому за ней возвращаемся
 * повторно: пока season_end_doy пуст и день года перевалил за AUTUMN_ATTEMPT_FROM_DOY.
 *
 * Тихо возвращает null'ы на любой ошибке сети/данных: сезонная поправка — уточнение,
 * из-за неё нельзя ронять обновление погоды.
 */
async function refreshSeason(db, garden, today = new Date(), deps = {}) {
  const { fetchFn = fetch } = deps
  const year = today.getFullYear()
  const stored = {
    start: garden.season_start_year === year ? garden.season_start_doy || null : null,
    end: garden.season_start_year === year ? garden.season_end_doy || null : null,
  }

  if (garden.lat == null || garden.lon == null) return stored
  const todayDoy = Math.floor((today - new Date(year, 0, 1)) / 86400000) + 1
  if (todayDoy < EARLIEST_DOY) return stored

  const springStale = garden.season_start_year !== year
  const autumnPending = !stored.end && todayDoy >= AUTUMN_ATTEMPT_FROM_DOY
  if (!springStale && !autumnPending) return stored

  try {
    const daily = await fetchSeasonTemps(garden.lat, garden.lon, year, fetchFn)
    if (!daily) return stored
    const { spring, autumn } = splitWindows(daily.time || [], daily.temperature_2m_mean || [])
    const start = transitionDoy(spring.time, spring.temps, true)
    const end = transitionDoy(autumn.time, autumn.temps, false)
    if (!start && !end) return stored // весна ещё не случилась — придём позже

    await db.query(
      'UPDATE gardens SET season_start_doy = $1, season_end_doy = $2, season_start_year = $3 WHERE id = $4',
      [start, end, year, garden.id]
    )
    return { start, end }
  } catch (err) {
    console.error(`[season] Участок ${garden.id}: не удалось определить границы сезона — ${err.message}`)
    return stored
  }
}

/** Актуально ли сохранённое начало сезона (посчитано за текущий год). */
function storedSeasonStart(garden, today = new Date()) {
  if (!garden || !garden.season_start_doy) return null
  return garden.season_start_year === today.getFullYear() ? garden.season_start_doy : null
}

/** Актуален ли сохранённый конец сезона. Тот же маркер года, что и у начала. */
function storedSeasonEnd(garden, today = new Date()) {
  if (!garden || !garden.season_end_doy) return null
  return garden.season_start_year === today.getFullYear() ? garden.season_end_doy : null
}

module.exports = {
  refreshSeason, storedSeasonStart, storedSeasonEnd, transitionDoy,
  THRESHOLD_C, SMOOTH_DAYS, AUTUMN_ATTEMPT_FROM_DOY,
}
