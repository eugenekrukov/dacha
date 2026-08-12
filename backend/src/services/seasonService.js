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
// Раньше этого дня года считать нечего — весна не наступала даже на юге (зона 6 ≈ 70).
const EARLIEST_DOY = 50

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
function transitionDoy(times, temps) {
  const pts = []
  for (let i = 0; i < times.length; i++) {
    if (temps[i] != null) pts.push({ doy: dayOfYear(times[i]), t: temps[i] })
  }
  if (pts.length < SMOOTH_DAYS) return null
  for (let k = HALF; k < pts.length - HALF; k++) {
    let sum = 0
    for (let j = k - HALF; j <= k + HALF; j++) sum += pts[j].t
    if (sum / SMOOTH_DAYS >= THRESHOLD_C) return pts[k].doy
  }
  return null
}

async function fetchSpringTemps(lat, lon, year, fetchFn = fetch) {
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}`
    + `&start_date=${year}-02-15&end_date=${year}-07-15`
    + '&daily=temperature_2m_mean&timezone=auto'
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`archive HTTP ${res.status}`)
  const json = await res.json()
  return json?.daily ?? null
}

/**
 * Пересчитывает начало сезона для участка, если значение за текущий год ещё не посчитано.
 * Возвращает день года или null (тогда работает норма по зоне).
 *
 * Тихо возвращает null на любой ошибке сети/данных: сезонная поправка — уточнение,
 * из-за него нельзя ронять обновление погоды.
 */
async function refreshSeasonStart(db, garden, today = new Date(), deps = {}) {
  const { fetchFn = fetch } = deps
  const year = today.getFullYear()

  if (garden.season_start_year === year && garden.season_start_doy) return garden.season_start_doy
  if (garden.lat == null || garden.lon == null) return null
  // Весна ещё не наступала — считать нечего, придём в следующий запуск джоба.
  const todayDoy = Math.floor((today - new Date(year, 0, 1)) / 86400000) + 1
  if (todayDoy < EARLIEST_DOY) return null

  try {
    const daily = await fetchSpringTemps(garden.lat, garden.lon, year, fetchFn)
    if (!daily) return null
    const doy = transitionDoy(daily.time || [], daily.temperature_2m_mean || [])
    if (!doy) return null // переход ещё не случился — попробуем позже
    await db.query(
      'UPDATE gardens SET season_start_doy = $1, season_start_year = $2 WHERE id = $3',
      [doy, year, garden.id]
    )
    return doy
  } catch (err) {
    console.error(`[season] Участок ${garden.id}: не удалось определить начало сезона — ${err.message}`)
    return null
  }
}

/** Актуально ли сохранённое значение (посчитано за текущий год). */
function storedSeasonStart(garden, today = new Date()) {
  if (!garden || !garden.season_start_doy) return null
  return garden.season_start_year === today.getFullYear() ? garden.season_start_doy : null
}

module.exports = { refreshSeasonStart, storedSeasonStart, transitionDoy, THRESHOLD_C, SMOOTH_DAYS }
