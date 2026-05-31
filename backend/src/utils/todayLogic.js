'use strict'

/**
 * Чистая функция сборки задач дня.
 * Не обращается к БД — только принимает данные и возвращает массив задач.
 * Это позволяет тестировать логику без Fastify/PostgreSQL.
 *
 * @param {Array}  plantings      — активные посадки (из БД / теста)
 * @param {Object|null} weather   — последний WeatherSnapshot
 * @param {Object} lastWateredMap — { [planting_id]: Date } последний полив
 * @param {Array}  reminders      — напоминания на сегодня (уже в формате задач)
 * @param {Date}   today          — текущая дата (параметр для тестируемости)
 * @returns {Array} задачи, отсортированные по приоритету, топ-5
 */
function buildTasks(plantings, weather, lastWateredMap, reminders, today = new Date()) {
  const TASK_PRIORITY = {
    frost_alert:    1,
    transplant_due: 2,
    watering_due:   3,
    harvest_due:    4,
    reminder:       5,
  }

  const tasks = []

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

    // 🌱 Пора пикировать / высаживать
    if (
      p.transplant_days &&
      daysSincePlanting >= p.transplant_days &&
      p.stage === 'sprouted'
    ) {
      tasks.push({
        type: 'transplant_due',
        priority: TASK_PRIORITY.transplant_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора пересаживать (${daysSincePlanting} дней)`,
        days_overdue: daysSincePlanting - p.transplant_days,
      })
    }

    // 💧 Нужен полив
    if (p.watering_freq_days) {
      const lastWatered = lastWateredMap[p.id] || plantedAt
      const daysSinceWatering = Math.floor((today - lastWatered) / 86400000)
      if (daysSinceWatering >= p.watering_freq_days) {
        tasks.push({
          type: 'watering_due',
          priority: TASK_PRIORITY.watering_due,
          planting_id: p.id,
          crop_name: p.crop_name,
          message: `${p.crop_name} — нужен полив (${daysSinceWatering} дн. без воды)`,
          days_overdue: daysSinceWatering - p.watering_freq_days,
        })
      }
    }

    // 🌾 Пора убирать урожай
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      ['growing', 'flowering', 'harvesting'].includes(p.stage)
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

  // Добавляем напоминания
  tasks.push(...reminders)

  // Сортировка: сначала по приоритету, потом по просроченности (desc)
  tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return (b.days_overdue || 0) - (a.days_overdue || 0)
  })

  return tasks.slice(0, 5)
}

/**
 * Форматирует массив задач в итоговый ответ API.
 */
function formatTasks(tasks) {
  return tasks.map(t => ({
    type: t.type,
    priority: t.priority,
    title: t.message || t.type,
    description: t.crop_name ? `Культура: ${t.crop_name}` : '',
    planting_id: t.planting_id || null,
    crop_name: t.crop_name || null,
    days_overdue: t.days_overdue || null,
  }))
}

module.exports = { buildTasks, formatTasks }
