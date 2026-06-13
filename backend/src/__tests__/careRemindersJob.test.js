'use strict'

const { runCareReminders } = require('../jobs/careRemindersJob')

// push внедряем параметром: проверяем, что джоб шлёт ОДИН сводный пуш на участок на тип.
let push
beforeEach(() => {
  push = {
    sendWateringDigest: vi.fn(async () => {}),
    sendFertilizingDigest: vi.fn(async () => {}),
    sendTransplantDigest: vi.fn(async () => {}),
  }
})

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

function planting(over = {}) {
  return {
    planting_id: 1,
    garden_id: 1,
    planted_at: daysAgo(30),
    conditions: 'soil',
    stage: 'growing',
    crop_name: 'Томат',
    watering_freq_days: 3,
    fertilizing_schedule: [],
    transplant_days: null,
    user_id: 1,
    ...over,
  }
}

// Мок-БД: маршрутизация по тексту SQL. alertSent — управляет дедупом care_alert_log.
function makeDb({ plantings, alertSent = false }) {
  const inserts = []
  return {
    inserts,
    query: async (sql, params) => {
      if (sql.includes('FROM plantings p')) return { rows: plantings }
      if (sql.includes("action_type = 'watering'")) return { rows: [] }
      if (sql.includes("action_type = 'fertilizing'")) return { rows: [] }
      if (sql.includes('FROM care_alert_log')) return { rows: alertSent ? [{ '?column?': 1 }] : [] }
      if (sql.includes('INSERT INTO care_alert_log')) { inserts.push(params); return { rows: [] } }
      return { rows: [] }
    },
  }
}

describe('careRemindersJob — сводный дайджест', () => {
  it('две просроченные по поливу посадки одного участка → один пуш с обеими культурами', async () => {
    const db = makeDb({
      plantings: [
        planting({ planting_id: 1, crop_name: 'Томат' }),
        planting({ planting_id: 2, crop_name: 'Огурец' }),
      ],
    })

    await runCareReminders(db, push)

    expect(push.sendWateringDigest).toHaveBeenCalledTimes(1)
    expect(push.sendWateringDigest).toHaveBeenCalledWith(db, 1, ['Томат', 'Огурец'])
    expect(push.sendFertilizingDigest).not.toHaveBeenCalled()
    expect(push.sendTransplantDigest).not.toHaveBeenCalled()
    // Каждая посадка помечена в care_alert_log (дедуп на день).
    expect(db.inserts).toHaveLength(2)
  })

  it('если уже уведомляли сегодня — пуш не шлётся', async () => {
    const db = makeDb({
      plantings: [planting({ planting_id: 1 })],
      alertSent: true,
    })

    await runCareReminders(db, push)

    expect(push.sendWateringDigest).not.toHaveBeenCalled()
    expect(db.inserts).toHaveLength(0)
  })

  it('подкормка: есть расписание и >14 дней без подкормки → дайджест подкормки', async () => {
    const db = makeDb({
      plantings: [planting({ fertilizing_schedule: [{ stage: 'growing' }], crop_name: 'Перец' })],
    })

    await runCareReminders(db, push)

    expect(push.sendFertilizingDigest).toHaveBeenCalledTimes(1)
    expect(push.sendFertilizingDigest).toHaveBeenCalledWith(db, 1, ['Перец'])
  })

  it('пересадка: рассада в стадии sowing и >= transplant_days → дайджест пересадки', async () => {
    const db = makeDb({
      plantings: [planting({ stage: 'sowing', sowing_method: 'seedling', transplant_days: 14, crop_name: 'Капуста' })],
    })

    await runCareReminders(db, push)

    expect(push.sendTransplantDigest).toHaveBeenCalledTimes(1)
    expect(push.sendTransplantDigest).toHaveBeenCalledWith(db, 1, ['Капуста'])
  })

  it('пересадка: прямой посев (direct) — дайджеста нет', async () => {
    const db = makeDb({
      plantings: [planting({ stage: 'sowing', sowing_method: 'direct', transplant_days: null, crop_name: 'Морковь' })],
    })

    await runCareReminders(db, push)

    expect(push.sendTransplantDigest).not.toHaveBeenCalled()
  })
})
