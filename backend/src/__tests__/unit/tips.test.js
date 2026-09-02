'use strict'

const { getStageTip, getCropStageTip } = require('../../data/tips')

// Форма данных — как в миграции 006 (укроп: полив с notes, подкормок нет, есть болезнь/вредитель).
const DILL = {
  watering_details: { growing: { freq_days: 3 }, notes: 'Умеренный полив. При засухе быстро идёт в стрелку.' },
  fertilizing_schedule: [],
  diseases: [{ name: 'Мучнистая роса', symptoms: 'Белый налёт на зонтиках', prevention: 'Прореживание' }],
  pests: [{ name: 'Тля зонтичная', signs: 'Колонии под зонтиком', prevention: '' }],
}

const TOMATO = {
  watering_details: { notes: 'Поливать тёплой водой 18-20°C строго под корень.' },
  fertilizing_schedule: [
    { stage: 'flowering', timing: 'При появлении первых цветочных кистей', product_example: 'Монофосфат калия', dose: '15 г на 10 л', method: 'root', notes: 'Азот резко снижаем.' },
    { stage: 'fruiting', timing: 'Каждые 10-14 дней', product_example: 'Сульфат калия', dose: '20 г на 10 л', method: 'root' },
  ],
  diseases: [],
  pests: [],
}

// Культура без агрономических данных — в справочнике таких 23 из 55 (напр. Горох).
const PEA = { watering_details: {}, fertilizing_schedule: [], diseases: [], pests: [] }

// Культура с советами по почве (форма — как в миграции 088).
const CUCUMBER = {
  watering_details: { notes: 'Поливать только тёплой водой, холодная тормозит рост.' },
  fertilizing_schedule: [],
  diseases: [],
  pests: [],
  soil_tips: {
    sandy: 'На песчаной почве вода уходит быстро — поливайте чаще и мельче, замульчируйте.',
    clay: 'На глине не давайте корке схватываться — рыхлите после каждого полива.',
  },
}

// Есть совет по почве, но никакой агрономии по стадии.
const SOIL_ONLY = {
  watering_details: {},
  fertilizing_schedule: [],
  diseases: [],
  pests: [],
  soil_tips: { peat: 'Торфяная почва кислая — раскислите золой перед посадкой.' },
}

describe('getStageTip', () => {
  it('рассадный посев (seedling) — совет по стадии как есть, дни не важны', () => {
    expect(getStageTip('sowing', 'seedling', 1)).toBeTruthy()
    expect(getStageTip('sowing', 'seedling', 30)).toBeTruthy()
  })

  it('прямой посев (direct), стадия "sowing" и ещё не проросло — совета про плёнку нет', () => {
    expect(getStageTip('sowing', 'direct', 3)).toBeNull()
  })

  it('прямой посев (direct), стадия "sowing" застряла надолго — совет как для "growing", не "первые дни"', () => {
    const tip = getStageTip('sowing', 'direct', 14)
    expect(tip).toBeTruthy()
    expect(tip).not.toMatch(/3–5 дней|плёнк/)
  })

  it('неизвестная стадия — null', () => {
    expect(getStageTip('done', 'direct', 100)).toBeNull()
  })

  it('прямой посев в грунт не получает советов про горшки/подоконник', () => {
    // Ни при каком дне месяца и ни при каком id посадки: «разворачивайте к свету»,
    // «досвечивайте лампой» — это про рассаду, не про грядку.
    for (const stage of ['sowing', 'sprouted', 'growing']) {
      for (let id = 0; id < 12; id++) {
        const tip = getStageTip(stage, 'direct', 30, id)
        if (tip) expect(tip).not.toMatch(/разворачивайте|досвечивайте|плёнк|Рассаде/)
      }
    }
  })

  it('рассада на подоконнике (стадия всходов) советы про досветку сохраняет', () => {
    const tips = new Set()
    for (let id = 0; id < 12; id++) tips.add(getStageTip('sprouted', 'seedling', 10, id))
    expect([...tips].some(t => /досвечивайте|светлое место/.test(t))).toBe(true)
  })

  it('стадия роста — ни одного совета про подоконник, даже у рассадного посева', () => {
    // К стадии роста рассада уже высажена в грунт: «разворачивать к свету» нечего.
    for (const method of ['seedling', 'direct']) {
      for (let id = 0; id < 24; id++) {
        expect(getStageTip('growing', method, 30, id)).not.toMatch(/разворачивайте|досвечивайте|подоконник/)
      }
    }
  })

  it('ни один совет по стадии не называет конкретную культуру или тип органа', () => {
    // Совет показывается подписанным именем культуры (recommendations.js: crop_name),
    // поэтому «окучьте картофель» на горохе и «трескаются корнеплоды» на укропе —
    // дезинформация. Пул общий → текст обязан подходить любой культуре.
    const forbidden = /картофел|капуст|томат|перц|перец|огурц|огурец|морков|свёкл|свекл|редис|горох|укроп|кабачк|тыкв|фасол|лук |чеснок|клубник|корнеплод|куст[еа]?\b/i
    for (const stage of ['sowing', 'sprouted', 'growing', 'flowering', 'harvesting']) {
      for (const method of ['seedling', 'direct']) {
        for (let id = 0; id < 24; id++) {
          const tip = getStageTip(stage, method, 30, id)
          if (tip) expect(tip).not.toMatch(forbidden)
        }
      }
    }
  })

  it('две разные посадки в один день получают разные советы', () => {
    const a = getStageTip('growing', 'seedling', 30, 1)
    const b = getStageTip('growing', 'seedling', 30, 2)
    expect(a).not.toBe(b)
  })
})

describe('getCropStageTip — советы про конкретную культуру', () => {
  const allTips = (crop, stage, method = 'seedling') => {
    const set = new Set()
    for (let id = 0; id < 24; id++) {
      const t = getCropStageTip(crop, stage, method, 30, id)
      if (t) set.add(t)
    }
    return [...set]
  }

  it('культура с агрономией отдаёт свой совет, а не общий по стадии', () => {
    const tips = allTips(DILL, 'growing')
    expect(tips.length).toBeGreaterThan(0)
    expect(tips.some(t => /идёт в стрелку/.test(t))).toBe(true)
  })

  it('культура без агрономии → null (вызывающий откатится на общий пул)', () => {
    expect(getCropStageTip(PEA, 'growing', 'seedling', 30, 1)).toBeNull()
    expect(getCropStageTip(null, 'growing', 'seedling', 30, 1)).toBeNull()
  })

  it('подкормка берётся только для текущей стадии (fruiting = стадия сбора)', () => {
    const flowering = allTips(TOMATO, 'flowering').join(' | ')
    const harvesting = allTips(TOMATO, 'harvesting').join(' | ')
    expect(flowering).toMatch(/Монофосфат калия/)
    expect(flowering).not.toMatch(/Сульфат калия/)
    expect(harvesting).toMatch(/Сульфат калия/)
    expect(harvesting).not.toMatch(/Монофосфат калия/)
  })

  it('болезни и вредители не показываются до всходов', () => {
    // На стадии посева осматривать ещё нечего.
    expect(allTips(DILL, 'sowing').join(' ')).not.toMatch(/Мучнистая роса|Тля/)
    expect(allTips(DILL, 'growing').join(' ')).toMatch(/Мучнистая роса|Тля/)
  })

  it('прямой посев в грунт: до всходов советов нет, после — как для растущей', () => {
    expect(getCropStageTip(DILL, 'sowing', 'direct', 3, 1)).toBeNull()
    expect(getCropStageTip(DILL, 'sowing', 'direct', 14, 1)).toBeTruthy()
  })
})

describe('getCropStageTip — почвенное примечание', () => {
  it('тип почвы участка есть и текст под него есть — примечание добавляется к совету по стадии', () => {
    const t = getCropStageTip(CUCUMBER, 'growing', 'seedling', 30, 1, 'sandy')
    expect(t).toMatch(/тёплой водой/)
    expect(t).toMatch(/песчаной почве/)
  })

  it('у участка тип почвы не указан — поведение ровно как сейчас', () => {
    expect(getCropStageTip(CUCUMBER, 'growing', 'seedling', 30, 1, null))
      .toBe(getCropStageTip(CUCUMBER, 'growing', 'seedling', 30, 1))
  })

  it('под этот тип почвы у культуры текста нет — поведение ровно как сейчас', () => {
    expect(getCropStageTip(CUCUMBER, 'growing', 'seedling', 30, 1, 'black_earth'))
      .toBe(getCropStageTip(CUCUMBER, 'growing', 'seedling', 30, 1))
  })

  it('пустая soil_tips (значение по умолчанию колонки) ничего не ломает', () => {
    const empty = { ...CUCUMBER, soil_tips: {} }
    expect(getCropStageTip(empty, 'growing', 'seedling', 30, 1, 'sandy'))
      .toBe(getCropStageTip(empty, 'growing', 'seedling', 30, 1))
  })

  it('агрономии по стадии нет, а совет по почве есть — отдаём почвенный, а не null', () => {
    expect(getCropStageTip(SOIL_ONLY, 'growing', 'seedling', 30, 1, 'peat'))
      .toBe('Торфяная почва кислая — раскислите золой перед посадкой.')
    expect(getCropStageTip(SOIL_ONLY, 'growing', 'seedling', 30, 1, 'loam')).toBeNull()
  })

  it('до всходов при прямом посеве почвенный совет тоже молчит', () => {
    expect(getCropStageTip(CUCUMBER, 'sowing', 'direct', 3, 1, 'sandy')).toBeNull()
  })
})
