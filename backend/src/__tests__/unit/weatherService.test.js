'use strict'

const { parseWeatherData } = require('../../services/weatherService')

// ─── Тестовый ответ Open-Meteo ────────────────────────────────────────────────

function makeOpenMeteoResponse({ minTemp = 10, maxTemp = 22, weatherCode = 0, tempC = 15 } = {}) {
  return {
    current: {
      temperature_2m: tempC,
      relative_humidity_2m: 60,
      weather_code: weatherCode,
      wind_speed_10m: 5,
      precipitation: 0,
    },
    daily: {
      temperature_2m_min: [minTemp],
      temperature_2m_max: [maxTemp],
      precipitation_sum: [0],
      weather_code: [weatherCode],
    },
  }
}

// ─── parseWeatherData ─────────────────────────────────────────────────────────

describe('parseWeatherData', () => {
  it('frost_risk=true когда min_temp_c <= 2', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ minTemp: 1 })).frost_risk).toBe(true)
  })

  it('frost_risk=true на границе: min=2', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ minTemp: 2 })).frost_risk).toBe(true)
  })

  it('frost_risk=false когда min_temp_c > 2', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ minTemp: 3 })).frost_risk).toBe(false)
  })

  it('heat_risk=true когда max_temp_c >= 35', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ maxTemp: 35 })).heat_risk).toBe(true)
  })

  it('heat_risk=false когда max_temp_c < 35', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ maxTemp: 34 })).heat_risk).toBe(false)
  })

  it('condition=clear для weatherCode=0', () => {
    const r = parseWeatherData(makeOpenMeteoResponse({ weatherCode: 0 }))
    expect(r.condition).toBe('clear')
    expect(r.condition_text).toBe('Ясно')
  })

  it('condition=cloudy для weatherCode=3', () => {
    const r = parseWeatherData(makeOpenMeteoResponse({ weatherCode: 3 }))
    expect(r.condition).toBe('cloudy')
    expect(r.condition_text).toBe('Пасмурно')
  })

  it('condition=rain для weatherCode=61', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ weatherCode: 61 })).condition).toBe('rain')
  })

  it('condition=snow для weatherCode=71', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ weatherCode: 71 })).condition).toBe('snow')
  })

  it('condition=storm для weatherCode=95', () => {
    const r = parseWeatherData(makeOpenMeteoResponse({ weatherCode: 95 }))
    expect(r.condition).toBe('storm')
    expect(r.condition_text).toBe('Гроза')
  })

  it('возвращает температуру', () => {
    expect(parseWeatherData(makeOpenMeteoResponse({ tempC: 18.5 })).temp_c).toBe(18.5)
  })

  it('frost_risk=false если min_temp_c=null', () => {
    const data = makeOpenMeteoResponse()
    data.daily.temperature_2m_min = [null]
    expect(parseWeatherData(data).frost_risk).toBe(false)
  })
})
