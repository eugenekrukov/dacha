'use strict'

const { WORKS, worksForWeek, workWindow } = require('../data/seasonalWorks')
const { SEASON_START_DOY, SEASON_END_DOY } = require('../utils/todayLogic')

const CROP_NAMES = new Set(['Арбуз', 'Виноград', 'Георгин', 'Гладиолус', 'Капуста белокочанная', 'Картофель',
  'Клубника', 'Лилия', 'Лук репчатый', 'Малина', 'Морковь', 'Огурец', 'Перец', 'Петуния', 'Пион', 'Редис',
  'Роза', 'Сельдерей', 'Смородина чёрная', 'Томат', 'Тыква', 'Фасоль стручковая', 'Чеснок', 'Яблоня'])

describe('seasonalWorks — контент', () => {
  it('id уникальны, поля заполнены, crop — существующая культура', () => {
    const ids = new Set()
    for (const w of WORKS) {
      expect(ids.has(w.id)).toBe(false)
      ids.add(w.id)
      expect(w.title.length).toBeGreaterThan(5)
      expect(w.details.length).toBeGreaterThan(20)
      expect(['spring', 'autumn', 'fixed']).toContain(w.anchor)
      if (w.crop) expect(CROP_NAMES.has(w.crop)).toBe(true)
    }
  })

  // Главное обещание блока: он не пустеет ни в одну неделю ни в одной зоне.
  for (const zone of ['3', '4', '5', '6']) {
    it(`зона ${zone}: на каждой неделе года ≥ 3 работ`, () => {
      const thin = []
      for (let doy = 1; doy <= 365; doy += 7) {
        const today = new Date(2027, 0, doy)
        const n = worksForWeek({ today, seasonStart: SEASON_START_DOY[zone], seasonEnd: SEASON_END_DOY[zone], limit: 99 }).length
        if (n < 3) thin.push(`${today.toISOString().slice(5, 10)}:${n}`)
      }
      expect(thin).toEqual([])
    })
  }
})

describe('worksForWeek', () => {
  const zone4 = { seasonStart: SEASON_START_DOY['4'], seasonEnd: SEASON_END_DOY['4'] }

  it('осенняя работа следует за фактическим концом сезона, а не за календарём', () => {
    const garlic = WORKS.find(w => w.id === 'garlic-plant')
    const early = workWindow(garlic, 101, 260)
    const late = workWindow(garlic, 101, 300)
    expect(late.from - early.from).toBe(40)
  })

  it('весенняя работа до начала сезона уходит в предыдущие дни года', () => {
    const w = workWindow(WORKS.find(x => x.id === 'sow-celery-leek'), 30, 300)
    expect(w.from).toBe(335)   // 30 − 60 → через Новый год
    expect(w.to).toBe(355)
  })

  it('культуры участка идут первыми и помечаются in_garden', () => {
    const today = new Date(2026, 8, 25) // 25 сентября, зона 4: копка, чеснок, сидераты…
    const all = worksForWeek({ today, ...zone4, limit: 99 })
    const mine = worksForWeek({ today, ...zone4, gardenCrops: new Set(['Чеснок']), limit: 99 })
    const garlic = mine.find(w => w.crop === 'Чеснок')
    expect(garlic).toBeTruthy()
    expect(garlic.in_garden).toBe(true)
    expect(mine[0].crop).toBe('Чеснок')
    expect(all.every(w => w.in_garden === false)).toBe(true)
  })

  it('ключ скрытия — год закрытия окна (зимняя работа из декабря не всплывает 1 января)', () => {
    const items = worksForWeek({ today: new Date(2026, 11, 20), ...zone4, limit: 99 })
    expect(items.find(w => w.id === 'plan-rotation').key).toBe('plan-rotation:2027')
  })

  it('limit ограничивает выдачу', () => {
    expect(worksForWeek({ today: new Date(2026, 4, 1), ...zone4, limit: 4 }).length).toBe(4)
  })
})

describe('GET /season-works', () => {
  const supertest = require('supertest')
  const { buildApp } = require('./helpers/buildApp')

  it('отдаёт работы недели с регионом, in_garden и ссылкой на справочник; гостю тоже', async () => {
    const app = await buildApp({
      query: async (sql) => {
        if (sql.includes('FROM gardens')) return { rows: [{ id: 5, user_id: 7, city: 'Тверь', climate_zone: '4' }] }
        if (sql.includes('SELECT DISTINCT c.name')) return { rows: [{ name: 'Томат' }] }
        if (sql.includes('SELECT name, slug FROM crops')) return { rows: [{ name: 'Томат', slug: 'tomat' }] }
        return { rows: [] }
      },
    })
    const token = app.jwt.sign({ userId: 7, email: null, guest: true })
    const res = await supertest(app.server).get('/season-works?garden_id=5').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.region).toBe('Тверь')
    expect(res.body.items.length).toBeGreaterThanOrEqual(3)
    const tomato = res.body.items.find(i => i.crop === 'Томат')
    if (tomato) {
      expect(tomato.in_garden).toBe(true)
      expect(tomato.link).toBe('https://calendacha.ru/spravochnik/kultury/tomat/')
    }
    await app.close()
  })

  it('чужой участок → 404', async () => {
    const app = await buildApp({ query: async () => ({ rows: [] }) })
    const token = app.jwt.sign({ userId: 7, email: 'a@b.c' })
    const res = await supertest(app.server).get('/season-works?garden_id=5').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    await app.close()
  })
})
