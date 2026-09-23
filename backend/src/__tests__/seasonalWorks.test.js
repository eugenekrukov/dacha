'use strict'

const { WORKS, worksForWeek, workWindow } = require('../data/seasonalWorks')
const { SEASON_START_DOY, SEASON_END_DOY } = require('../utils/todayLogic')

// crops.name на проде (GET /crops, 67 культур, 2026-09-23) — опечатка в названии молча выключила бы «у вас есть».
const CROP_NAMES = new Set(('Арбуз Базилик Баклажан Бархатцы Виноград Вишня Георгин Гладиолус Голубика Горох Груша Дыня ' +
  'Ежевика Ирга Кабачок Картофель Кинза Клубника Крыжовник Кукуруза Лилия Лук-батун Лук-порей Малина Морковь Мята ' +
  'Облепиха Огурец Пастернак Патиссон Перец Петрушка Петуния Пион Ревень Редис Редька Репа Роза Свёкла Сельдерей ' +
  'Слива Тимьян Томат Тыква Укроп Флокс Хоста Хрен Черешня Чеснок Шпинат Щавель Яблоня').split(' ')
  .concat(['Жимолость съедобная', 'Ирис бородатый', 'Капуста белокочанная', 'Капуста брокколи', 'Капуста пекинская',
    'Капуста цветная', 'Лук репчатый', 'Перец острый', 'Салат листовой', 'Смородина белая', 'Смородина красная',
    'Смородина чёрная', 'Фасоль стручковая']))

describe('seasonalWorks — контент', () => {
  it('id уникальны, поля заполнены, crop — существующая культура', () => {
    const ids = new Set()
    for (const w of WORKS) {
      expect(ids.has(w.id)).toBe(false)
      ids.add(w.id)
      expect(w.title.length).toBeGreaterThan(5)
      expect(w.details.length).toBeGreaterThan(20)
      expect(['spring', 'autumn', 'fixed']).toContain(w.anchor)
      for (const c of [].concat(w.crop || [])) expect([w.id, CROP_NAMES.has(c)]).toEqual([w.id, true])
    }
  })

  // Главное обещание блока: он не пустеет ни в одну неделю ни в одной зоне.
  for (const zone of ['3', '4', '5', '6']) {
    it(`зона ${zone}: на каждой неделе года ≥ 3 работ`, () => {
      const thin = []
      for (let doy = 1; doy <= 365; doy += 7) {
        const today = new Date(2027, 0, doy)
        const n = worksForWeek({ today, seasonStart: SEASON_START_DOY[zone], seasonEnd: SEASON_END_DOY[zone], zone, limit: 99 }).length
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

  it('работы про снег не показываются на юге (zones)', () => {
    const jan = new Date(2027, 0, 20)
    const ids = z => worksForWeek({ today: jan, seasonStart: SEASON_START_DOY[z], seasonEnd: SEASON_END_DOY[z], zone: z, limit: 99 }).map(w => w.id)
    expect(ids('4')).toContain('snow-retention')
    expect(ids('6')).not.toContain('snow-retention')
  })

  it('crop-список: «у вас есть» по любой культуре из списка, ссылка — по первой', () => {
    const items = worksForWeek({ today: new Date(2026, 8, 25), ...zone4, gardenCrops: new Set(['Смородина красная']), limit: 99 })
    const shrubs = items.find(w => w.id === 'shrubs-plant')
    expect(shrubs.in_garden).toBe(true)
    expect(shrubs.crop).toBe('Смородина чёрная')
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
