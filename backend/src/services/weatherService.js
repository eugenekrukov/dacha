'use strict'

const fetch = require('node-fetch')

// WMO weather interpretation codes → человекочитаемые строки (на русском)
const WMO_CODES = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь',
  51: 'Лёгкая морось',
  53: 'Морось',
  55: 'Сильная морось',
  61: 'Лёгкий дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  71: 'Лёгкий снег',
  73: 'Снег',
  75: 'Сильный снег',
  80: 'Ливень',
  81: 'Ливни',
  82: 'Сильный ливень',
  85: 'Снегопад',
  86: 'Сильный снегопад',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Сильная гроза с градом'
}

/**
 * Запрашивает текущую погоду и дневной прогноз из Open-Meteo.
 * Open-Meteo — бесплатный, без API-ключа, работает глобально.
 *
 * @param {number} lat — широта
 * @param {number} lon — долгота
 * @returns {Object} Нормализованный объект погоды
 */
async function fetchWeatherData(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('current', [
    'temperature_2m',
    'relative_humidity_2m',
    'weather_code',
    'wind_speed_10m',
    'precipitation'
  ].join(','))
  url.searchParams.set('daily', [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'weather_code'
  ].join(','))
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '3')

  const res = await fetch(url.toString(), { timeout: 10000 })
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)

  const data = await res.json()
  const current = data.current
  const daily = data.daily

  const minTemp = daily.temperature_2m_min?.[0] ?? null
  const maxTemp = daily.temperature_2m_max?.[0] ?? null
  const precipitation = daily.precipitation_sum?.[0] ?? 0
  const weatherCode = current.weather_code ?? 0

  // Категория condition (для БД: clear | cloudy | rain | snow | storm)
  let conditionCategory = 'clear'
  if (weatherCode >= 95) conditionCategory = 'storm'
  else if (weatherCode >= 71) conditionCategory = 'snow'
  else if (weatherCode >= 51) conditionCategory = 'rain'
  else if (weatherCode >= 2) conditionCategory = 'cloudy'

  return {
    temp_c: current.temperature_2m ?? null,
    min_temp_c: minTemp,
    max_temp_c: maxTemp,
    humidity_pct: current.relative_humidity_2m ?? null,
    wind_ms: current.wind_speed_10m ?? null,
    precip_mm: precipitation,
    condition: conditionCategory,
    condition_text: WMO_CODES[weatherCode] ?? 'Неизвестно',
    frost_risk: minTemp !== null && minTemp <= 2,
    heat_risk: maxTemp !== null && maxTemp >= 35
  }
}

/**
 * Обновляет weather_snapshot для одного участка.
 * Если данные уже свежие (< 3 часов) — пропускает.
 *
 * @param {Object} db — pg Pool
 * @param {Object} garden — строка из таблицы gardens { id, lat, lon }
 */
async function updateGardenWeather(db, garden) {
  const { id: gardenId, lat, lon } = garden

  if (!lat || !lon) {
    console.warn(`[weather] Garden ${gardenId}: нет координат, пропускаю`)
    return
  }

  // Проверяем свежесть кэша
  const cached = await db.query(
    `SELECT id FROM weather_snapshots
     WHERE garden_id=$1 AND fetched_at > NOW() - INTERVAL '3 hours'
     ORDER BY fetched_at DESC LIMIT 1`,
    [gardenId]
  )
  if (cached.rows[0]) {
    console.log(`[weather] Garden ${gardenId}: кэш свежий, пропускаю`)
    return
  }

  const weather = await fetchWeatherData(lat, lon)

  await db.query(
    `INSERT INTO weather_snapshots
     (garden_id, temp_c, min_temp_c, max_temp_c, humidity_pct, wind_ms,
      precip_mm, condition, condition_text, frost_risk, heat_risk, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
    [
      gardenId,
      weather.temp_c,
      weather.min_temp_c,
      weather.max_temp_c,
      weather.humidity_pct,
      weather.wind_ms,
      weather.precip_mm,
      weather.condition,
      weather.condition_text,
      weather.frost_risk,
      weather.heat_risk
    ]
  )

  console.log(`[weather] Garden ${gardenId}: обновлено — ${weather.temp_c}°C, ${weather.condition}`)
  return weather
}

module.exports = { fetchWeatherData, updateGardenWeather }
