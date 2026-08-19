'use strict'

const supertest = require('supertest')
const { buildApp, makeToken, freeTierQuery } = require('./helpers/buildApp')

const PLANTING = {
  id: 1, garden_id: 1, crop_id: 1, stage: 'sowing',
  planted_at: new Date().toISOString(), quantity: 1, conditions: 'soil',
  crop_name: 'Помидор', category: 'vegetables', watering_freq_days: 3,
  frost_sensitive: true, harvest_days: 90, care_tasks: null, last_action_at: null,
}

// Запрос free-набора перехватываем здесь: по умолчанию посадка 1 не заблокирована,
// поэтому кейсы ниже проверяют свою логику, а не гейт (гейт — отдельным describe).
function makeMockDb(overrides = {}) {
  const base = { query: async () => ({ rows: [] }), ...overrides }
  return { ...base, query: async (sql, params) => freeTierQuery(sql) || base.query(sql, params) }
}

// Ответ на гейт free-лимита: free-пользователь (нет подписки/промо), COUNT ниже лимита по умолчанию.
function gateQuery(sql, { subscribed = false, plantingCount = 0 } = {}) {
  if (sql.includes('SELECT subscription_until, promo_until, store FROM users')) {
    return { rows: [{ subscription_until: subscribed ? new Date(Date.now() + 86400000) : null, promo_until: null, store: null }] }
  }
  if (sql.includes('COUNT(*) FROM plantings')) {
    return { rows: [{ count: String(plantingCount) }] }
  }
  return null
}

describe('POST /plantings', () => {
  it('создаёт посадку со stage=sowing и возвращает 201', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        // Проверка владельца участка проходит
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(201)
    expect(res.body.stage).toBe('sowing')
    await app.close()
  })

  it('free-пользователь на лимите (3 активных посадки) → 402 plan_limit_reached', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql, { plantingCount: 3 })
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('plan_limit_reached')
    await app.close()
  })

  it('подписчик «Дачник Про» создаёт посадку сверх лимита свободно', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql, { subscribed: true, plantingCount: 10 })
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1 })

    expect(res.status).toBe(201)
    await app.close()
  })

  it('403 при создании посадки в чужом участке (IDOR)', async () => {
    // Мок: проверка владельца возвращает пусто → участок не принадлежит пользователю
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 999, crop_id: 1 })

    expect(res.status).toBe(403)
    await app.close()
  })

  it('401 без токена', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).post('/plantings').send({ garden_id: 1, crop_id: 1 })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('принимает bed_id и проверяет, что грядка принадлежит тому же участку', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('FROM garden_beds')) return { rows: [{ ok: 1 }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [{ ...PLANTING, bed_id: 10 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1, bed_id: 10 })

    expect(res.status).toBe(201)
    expect(res.body.bed_id).toBe(10)
    await app.close()
  })

  it('400 если bed_id не принадлежит указанному участку', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('FROM garden_beds')) return { rows: [] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1, bed_id: 999 })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('принимает variety_id и подставляет имя сорта в variety', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('FROM crop_varieties')) return { rows: [{ name: 'Санька' }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [{ ...PLANTING, variety: 'Санька', variety_id: 5 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1, variety_id: 5 })

    expect(res.status).toBe(201)
    expect(res.body.variety).toBe('Санька')
    await app.close()
  })

  it('400 если variety_id принадлежит другой культуре', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        if (sql.includes('FROM crop_varieties')) return { rows: [] } // сорт другой культуры — не найден по паре (id, crop_id)
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1, variety_id: 5 })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('свободный текст сорта без variety_id заводит новую запись в общем справочнике сортов', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        const gated = gateQuery(sql)
        if (gated) return gated
        if (sql.includes('FROM gardens')) return { rows: [{ ok: 1 }] }
        // Похожего сорта у культуры ещё нет.
        if (sql.includes('similarity(lower(name)')) return { rows: [] }
        if (sql.includes('INSERT INTO crop_varieties')) return { rows: [{ id: 42, name: 'Мой сорт с дачи' }] }
        if (sql.includes('INSERT INTO plantings')) return { rows: [{ ...PLANTING, variety: 'Мой сорт с дачи', variety_id: 42 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/plantings')
      .set('Authorization', `Bearer ${token}`)
      .send({ garden_id: 1, crop_id: 1, variety: 'Мой сорт с дачи' })

    expect(res.status).toBe(201)
    expect(res.body.variety_id).toBe(42)
    expect(res.body.variety).toBe('Мой сорт с дачи')
    await app.close()
  })
})

describe('GET /plantings', () => {
  it('возвращает посадки текущего пользователя', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ crop_name: 'Помидор' })
    await app.close()
  })

  it('фильтрует по garden_id', async () => {
    let capturedSql = ''
    const app = await buildApp(makeMockDb({
      query: async (sql) => { capturedSql = sql; return { rows: [] } },
    }))
    const token = makeToken(app)

    await supertest(app.server)
      .get('/plantings?garden_id=1')
      .set('Authorization', `Bearer ${token}`)

    expect(capturedSql).toContain('garden_id')
    await app.close()
  })

  it('не содержит care_tasks в ответе (внутреннее поле)', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0]).not.toHaveProperty('care_tasks')
    await app.close()
  })

  it('возвращает next_care_task для каждой посадки', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0]).toHaveProperty('next_care_task')
    await app.close()
  })

  it('возвращает expected_harvest_at = planted_at + harvest_days (для календаря клиентов)', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [PLANTING] }),  // planted_at=сегодня, harvest_days=90
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0]).toHaveProperty('expected_harvest_at')
    const expected = new Date(new Date(PLANTING.planted_at).getTime() + 90 * 86400000)
    const got = new Date(res.body[0].expected_harvest_at)
    // ± сутки (сравниваем по дате, без точного совпадения миллисекунд)
    expect(Math.abs(got - expected)).toBeLessThan(86400000)
    await app.close()
  })

  it('многолетник без harvest_days: expected_harvest_at считается по окну съёма (harvest_doy_*)', async () => {
    const berryPlanting = {
      ...PLANTING, harvest_days: null, is_perennial: true,
      harvest_doy_start: 213, harvest_doy_end: 244, // 1-31 августа
      planted_at: new Date('2024-05-01').toISOString(), // давно, чтобы не мешала anniversary-логика
    }
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [berryPlanting] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0].expected_harvest_at).not.toBeNull()
    const got = new Date(res.body[0].expected_harvest_at)
    expect(got.getMonth()).toBe(7) // август (0-indexed) — либо в этом, либо в следующем году
    await app.close()
  })

  it('для завершённой посадки (stage=done) next_care_task — null, даже если есть будущая care-задача', async () => {
    const donePlanting = {
      ...PLANTING,
      stage: 'done',
      planted_at: new Date().toISOString(),
      care_tasks: [{ name: 'Пасынкование', day_offset: 100, repeat_days: null }],
    }
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [donePlanting] }),
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body[0].next_care_task).toBeNull()
    expect(res.body[0].overdue_care_task).toBeNull()
    await app.close()
  })
})

describe('PATCH /plantings/:id/info', () => {
  it('обновляет bed_id (COALESCE — без bed_id в body значение не трогается)', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM garden_beds')) return { rows: [{ ok: 1 }] }
        return { rows: [{ ...PLANTING, bed_id: 10 }] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ bed_id: 10 })

    expect(res.status).toBe(200)
    expect(res.body.bed_id).toBe(10)
    await app.close()
  })

  it('400 если bed_id не принадлежит участку этой посадки', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM garden_beds')) return { rows: [] }
        return { rows: [{ ...PLANTING, bed_id: 10 }] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ bed_id: 999 })

    expect(res.status).toBe(400)
    await app.close()
  })

  it('без bed_id в body не запускает проверку грядки и не трогает значение', async () => {
    let capturedParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE plantings')) { capturedParams = params; return { rows: [{ ...PLANTING, bed_id: 10 }] } }
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }  // проверка владельца
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 })

    expect(res.status).toBe(200)
    expect(capturedParams[capturedParams.length - 1]).toBeNull()
    await app.close()
  })

  it('variety_id принимает сорт из справочника и подставляет имя', async () => {
    let capturedParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE plantings')) { capturedParams = params; return { rows: [{ ...PLANTING, variety: 'Санька', variety_id: 5 }] } }
        if (sql.includes('FROM crop_varieties')) return { rows: [{ name: 'Санька' }] }
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ variety_id: 5 })

    expect(res.status).toBe(200)
    expect(res.body.variety).toBe('Санька')
    // variety_id — последний $10, но т.к. добавили variety_id в params, проверяем позицию явно
    expect(capturedParams[capturedParams.length - 1]).toBe(5)
    await app.close()
  })

  it('clear_variety_id:true без нового текста сорта сбрасывает variety_id, даже если Moshi не может послать явный null', async () => {
    let capturedParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE plantings')) { capturedParams = params; return { rows: [{ ...PLANTING, variety_id: null }] } }
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ variety: '', clear_variety_id: true })

    expect(res.status).toBe(200)
    // varietyIdSet=true, varietyIdVal=null → последний параметр (variety_id) — null
    expect(capturedParams[capturedParams.length - 1]).toBeNull()
    await app.close()
  })

  it('свободный текст сорта без variety_id заводит/сопоставляет запись в общем справочнике сортов', async () => {
    let capturedParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }
        // Похожего сорта у культуры ещё нет — нечёткий поиск ничего не находит.
        if (sql.includes('similarity(lower(name)')) return { rows: [] }
        // Заводим новую запись в crop_varieties — общий справочник, доступный всем пользователям.
        if (sql.includes('INSERT INTO crop_varieties')) return { rows: [{ id: 42, name: 'Мой сорт с дачи' }] }
        if (sql.includes('UPDATE plantings')) { capturedParams = params; return { rows: [{ ...PLANTING, variety: 'Мой сорт с дачи', variety_id: 42 }] } }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ variety: 'Мой сорт с дачи' })

    expect(res.status).toBe(200)
    expect(res.body.variety_id).toBe(42)
    // variety_id — последний параметр UPDATE
    expect(capturedParams[capturedParams.length - 1]).toBe(42)
    await app.close()
  })

  it('опечатка в сорте автоматически сопоставляется с уже существующим в справочнике (без дубля)', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }
        // Нечёткое совпадение находит существующую запись — используем её id и каноничное имя.
        if (sql.includes('similarity(lower(name)')) return { rows: [{ id: 3, name: 'Бычье сердце', sim: 0.78 }] }
        if (sql.includes('UPDATE plantings')) return { rows: [{ ...PLANTING, variety: 'Бычье сердце', variety_id: 3 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ variety: 'Бычье серце' }) // опечатка

    expect(res.status).toBe(200)
    expect(res.body.variety_id).toBe(3)
    expect(res.body.variety).toBe('Бычье сердце') // исправленное написание
    await app.close()
  })

  it('400 если variety_id принадлежит другой культуре', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM crop_varieties')) return { rows: [] }
        if (sql.includes('FROM plantings p')) return { rows: [PLANTING] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${token}`)
      .send({ variety_id: 999 })

    expect(res.status).toBe(400)
    await app.close()
  })
})

describe('GET /plantings/:id', () => {
  it('возвращает посадку по id', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [PLANTING] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1 })
    await app.close()
  })

  it('404 для чужой посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/plantings/99')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('PATCH /plantings/:id/stage', () => {
  it('обновляет стадию посадки', async () => {
    const updated = { ...PLANTING, stage: 'sprouted' }
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [updated] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'sprouted' })

    expect(res.status).toBe(200)
    expect(res.body.stage).toBe('sprouted')
    await app.close()
  })

  it('404 для несуществующей посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/plantings/99/stage')
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'sprouted' })

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('read-only гейт free-тарифа (посадки сверх free-набора)', () => {
  // Мок: посадка 1 вне свободного набора → без подписки она только для чтения.
  function lockedDb({ subscribed = false, stage = 'growing' } = {}) {
    return {
      query: async (sql) => {
        const ft = freeTierQuery(sql, { subscribed, freeIds: [7, 8, 9] })
        if (ft) return ft
        if (sql.includes('FROM plantings p')) return { rows: [{ id: 1, stage }] }
        return { rows: [{ ...PLANTING, stage }] }
      },
    }
  }

  it('PATCH /:id/info по заблокированной посадке → 402 planting_locked', async () => {
    const app = await buildApp(lockedDb())
    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ quantity: 5 })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('planting_locked')
    await app.close()
  })

  it('PATCH /:id/stage по заблокированной посадке → 402', async () => {
    const app = await buildApp(lockedDb())
    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ stage: 'flowering' })

    expect(res.status).toBe(402)
    await app.close()
  })

  it('завершение заблокированной посадки (stage=done) разрешено — освобождает слот free-набора', async () => {
    const app = await buildApp(lockedDb())
    const res = await supertest(app.server)
      .patch('/plantings/1/stage')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ stage: 'done' })

    expect(res.status).toBe(200)
    await app.close()
  })

  it('подписка активна → блокировки нет', async () => {
    const app = await buildApp(lockedDb({ subscribed: true }))
    const res = await supertest(app.server)
      .patch('/plantings/1/info')
      .set('Authorization', `Bearer ${makeToken(app)}`)
      .send({ quantity: 5 })

    expect(res.status).toBe(200)
    await app.close()
  })

  it('GET /plantings отдаёт locked=true для посадки вне free-набора', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [PLANTING] },
    })
    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.body[0].locked).toBe(true)
    await app.close()
  })

  it('GET /plantings отдаёт locked=false для посадки из free-набора', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [1] }) || { rows: [PLANTING] },
    })
    const res = await supertest(app.server)
      .get('/plantings')
      .set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.body[0].locked).toBe(false)
    await app.close()
  })

  it('DELETE не блокируется — удалить лишнюю посадку можно всегда', async () => {
    const app = await buildApp({
      query: async (sql) => freeTierQuery(sql, { freeIds: [7, 8, 9] }) || { rows: [{ id: 1 }] },
    })
    const res = await supertest(app.server)
      .delete('/plantings/1')
      .set('Authorization', `Bearer ${makeToken(app)}`)

    expect(res.status).toBe(200)
    await app.close()
  })
})

describe('DELETE /plantings/:id', () => {
  it('удаляет посадку и возвращает 200', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [{ id: 1 }] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/plantings/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true })
    await app.close()
  })

  it('404 для чужой посадки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/plantings/99')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})
