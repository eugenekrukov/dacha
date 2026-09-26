# Площадь грядок + советы по типу почвы — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать суммарную площадь грядок в шапке «Мой участок» и завести механизм культуро-специфичных советов по типу почвы (колонка + подмешивание в совет дня + UI выбора почвы), не наполняя контент.

**Architecture:** Два независимых куска. (A) Чистая функция суммирования по уже отдаваемому `GET /gardens/:id/beds` — ни роутов, ни колонок. (B) Новая JSONB-колонка `crops.soil_tips` (в проде пустая), чтение `gardens.soil_type` в `getCropStageTip`, откат к текущему поведению при пустых данных, пикер почвы в экране правки участка на обеих платформах.

**Tech Stack:** Fastify + PostgreSQL (backend, тесты vitest — `npm test`), React + TypeScript + Tailwind (web, тест-раннера в проекте нет — проверка через `npm run typecheck` и превью), Kotlin/Compose + JUnit (android, `./gradlew test`).

**Спека:** `docs/superpowers/specs/2026-09-02-garden-area-soil-tips-design.md`

---

## Отклонения от спеки (осознанные, зафиксировать при ревью)

1. **Подсказка «N грядок без размера» — текст без перехода.** Спека говорит «подсказка ведёт к тому же пикеру грядок». Отдельного экрана грядок нет ни на web, ни на Android: пикер (`BedField.tsx` / `BedPickerField.kt`) живёт внутри формы посадки и открывается только в контексте конкретной посадки. Строить экран грядок — новая фича вне объёма задачи. Подсказка остаётся информационной строкой, текст прямо называет, где вписать размер.
2. **Пикер почвы только в экране правки участка** (`EditGardenScreen.tsx`, `GardenEditScreen.kt`), не в создании. Создание участка на обеих платформах — шаг онбординга; тип почвы там ничего не решает (посадок ещё нет, советов тоже), а лишнее поле удлиняет онбординг. Спека для Android называет ровно `GardenEditScreen.kt` — web приводим к тому же.
3. **`PUT /gardens/:id` получает `COALESCE` по `soil_type`.** Сейчас роут пишет `soil_type=$5` безусловно: любой клиент, который поле не шлёт (в том числе уже установленные старые версии Android), обнулит выбранный тип почвы при обычной правке названия. Сброс типа почвы продуктом не предусмотрен (в пикере 5 значений), поэтому `COALESCE($5, soil_type)` — правильная семантика, а не костыль. Снятие выбора в пикере остаётся локальным до сохранения: сохранить «пусто» после того, как значение было, нельзя — это осознанный размен на защиту от старых клиентов.

---

## File Structure

**Backend**
- Create: `backend/src/db/migrations/088_crops_soil_tips.sql` — колонка `crops.soil_tips JSONB DEFAULT '{}'`.
- Modify: `backend/src/data/tips.js` — `getCropStageTip` принимает `soilType`, подмешивает почвенное примечание.
- Modify: `backend/src/routes/recommendations.js` — `c.soil_tips` в выборку посадок, `garden.soil_type` в вызов `getCropStageTip`.
- Modify: `backend/src/routes/gardens.js` — `COALESCE` по `soil_type` в PUT.
- Test: `backend/src/__tests__/unit/tips.test.js` (дополняется), `backend/src/__tests__/gardens.test.js` (дополняется).

**Web**
- Modify: `web/src/api/types.ts` — `soil_type` в `Garden` и `CreateGardenRequest`.
- Modify: `web/src/screens/EditGardenScreen.tsx` — пикер почвы (чипы), отправка `soil_type`.
- Modify: `web/src/screens/ProfileScreen.tsx` — строки площади грядок в шапке + локальная чистая функция `bedsAreaLines`.

**Android**
- Modify: `android/.../data/repository/GardenRepository.kt` — параметр `soilType` в `updateGarden`.
- Modify: `android/.../ui/garden/GardenEditViewModel.kt` — `saveGarden` пробрасывает `soilType`.
- Modify: `android/.../ui/garden/GardenEditScreen.kt` — пикер почвы (ряд `FilterChip`).
- Modify: `android/.../ui/profile/FeedViewModel.kt` — грузит грядки, кладёт строки площади в `FeedUiState`.
- Modify: `android/.../ui/profile/ProfileScreen.kt` — `ProfileHeader` печатает строки + чистая функция `bedsAreaLines`.
- Test: `android/app/src/test/java/ru/dachakalend/app/profile/BedsAreaTest.kt` (новый).

**Docs**
- Modify: `docs/ux-roadmap.md` §5.1, `session-note.md`, `summary.md`.

Куски A (площадь грядок: Task 6, 8) и B (почва: Task 1–5, 7) независимы — порядок задач внутри плана удобный, но не обязательный.

---

## Task 1: Миграция — колонка `crops.soil_tips`

**Files:**
- Create: `backend/src/db/migrations/088_crops_soil_tips.sql`

- [ ] **Step 1: Написать миграцию**

Создать `backend/src/db/migrations/088_crops_soil_tips.sql`:

```sql
-- Migration 088: crops.soil_tips — культуро-специфичные советы по типу почвы.
--
-- ПРИЧИНА: gardens.soil_type принимается роутами с миграции 001, но нигде не читается —
-- метаданные без пользы (docs/ux-roadmap.md §5.1). Польза найдена (владелец, 2026-09-02):
-- тип почвы должен влиять на советы по поливу/подкормке/уходу и давать советы по улучшению
-- почвы. Дизайн: docs/superpowers/specs/2026-09-02-garden-area-soil-tips-design.md.
--
-- Форма — JSONB на культуру, по образцу уже существующих watering_details/fertilizing_schedule,
-- а не join-таблица «культура × почва»: одна строка на культуру (67) вместо 335 при том же
-- покрытии. Ключи — те же 5 типов, что в комментарии к gardens.soil_type (миграция 001):
--   { "loam": "…", "sandy": "…", "clay": "…", "peat": "…", "black_earth": "…" }
--
-- Едет пустой: контент (67 культур × 5 типов) — предметная агрономия, пишется отдельными
-- батчами с проверкой по 2+ источникам, как справочник болезней/вредителей (081/082).
-- Механизм рассчитан на пустоту: нет значения → совет дня работает ровно как сейчас.
--
-- Идемпотентна: ADD COLUMN IF NOT EXISTS, безопасно перегонять повторно.

ALTER TABLE crops ADD COLUMN IF NOT EXISTS soil_tips JSONB DEFAULT '{}';
COMMENT ON COLUMN crops.soil_tips IS
  'Советы по типу почвы для этой культуры: {loam|sandy|clay|peat|black_earth: текст}. Пустой объект — советов нет, показывается только совет по стадии.';
```

- [ ] **Step 2: Прогнать миграцию локально**

Run: `cd backend && npm run migrate`
Expected: в выводе строка про `088_crops_soil_tips`, процесс завершается без ошибок.

- [ ] **Step 3: Проверить, что колонка есть и пустая**

Run:

```bash
cd backend && node -e "require('dotenv').config();const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT count(*) total, count(*) FILTER (WHERE soil_tips <> '{}') filled FROM crops\").then(r=>{console.log(r.rows[0]);return p.end()})"
```

Expected: `{ total: '67', filled: '0' }` — число культур может отличаться, `filled` обязан быть `0`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/088_crops_soil_tips.sql
git commit -m "feat(db): колонка crops.soil_tips под советы по типу почвы"
```

---

## Task 2: Почвенное примечание в совете дня (`tips.js`)

Правило показа: агрономия по стадии — основа, почвенное примечание — дополнение. Если у культуры нет ни одного совета по стадии, но есть текст под тип почвы — возвращаем почвенный совет один (он тоже культуро-специфичный, терять его незачем). Нет типа почвы у участка или нет текста под него — поведение ровно как сейчас.

**Files:**
- Modify: `backend/src/data/tips.js:306-320`
- Test: `backend/src/__tests__/unit/tips.test.js`

- [ ] **Step 1: Написать падающие тесты**

В `backend/src/__tests__/unit/tips.test.js` после константы `PEA` добавить фикстуры:

```js
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
```

И в конец файла — новый `describe`:

```js
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
```

- [ ] **Step 2: Прогнать тесты — убедиться, что падают**

Run: `cd backend && npx vitest run src/__tests__/unit/tips.test.js`
Expected: FAIL — новый `describe` красный (примечание не добавляется, `SOIL_ONLY` даёт `null`); старые тесты файла зелёные.

- [ ] **Step 3: Реализовать**

В `backend/src/data/tips.js` заменить функцию `getCropStageTip` (вместе с комментарием над ней, строки 305–320) на:

```js
// Примечание про тип почвы участка — дополнение к агрономии по стадии, не замена.
// Нет типа почвы у участка (подавляющее большинство участков сегодня) или нет текста под
// него у культуры — возвращаем null, вызывающий не замечает разницы.
function soilNote(crop, soilType) {
  if (!crop || !soilType) return null
  const note = (crop.soil_tips || {})[soilType]
  return typeof note === 'string' && note.trim() ? note.trim() : null
}

// Совет именно про эту культуру; null — если агрономии по ней нет (вызывающий должен
// откатиться на нейтральный getStageTip).
function getCropStageTip(crop, stage, sowingMethod, daysSincePlanting, plantingId = 0, soilType = null) {
  // Стадию нормализуем так же, как в getStageTip: у прямого посева БД-стадия 'sowing'
  // висит всю жизнь, и советы про подкормку рассады ему не адресованы.
  let effectiveStage = stage
  if (sowingMethod === 'direct' && stage === 'sowing') {
    effectiveStage = daysSincePlanting >= DIRECT_SOWING_GERMINATION_DAYS ? 'growing' : null
  }
  if (!effectiveStage) return null

  const note = soilNote(crop, soilType)
  const tips = buildCropStageTips(crop, effectiveStage)
  // Агрономии по стадии нет, но почвенный совет культуро-специфичен — терять его незачем.
  if (tips.length === 0) return note
  const tip = tips[(new Date().getDate() + plantingId) % tips.length]
  return note ? `${tip} ${note}` : tip
}
```

- [ ] **Step 4: Прогнать тесты — убедиться, что проходят**

Run: `cd backend && npx vitest run src/__tests__/unit/tips.test.js`
Expected: PASS, все тесты файла зелёные.

- [ ] **Step 5: Commit**

```bash
git add backend/src/data/tips.js backend/src/__tests__/unit/tips.test.js
git commit -m "feat(tips): почвенное примечание подмешивается в культуро-специфичный совет дня"
```

---

## Task 3: Прокинуть тип почвы и `soil_tips` в `/recommendations`

**Files:**
- Modify: `backend/src/routes/recommendations.js:36-44` (SELECT), `:117-120` (вызов `getCropStageTip`)

- [ ] **Step 1: Добавить `soil_tips` в выборку посадок**

В `backend/src/routes/recommendations.js` в запросе «2. Активные посадки с данными культур» строку

```js
              c.watering_details, c.diseases, c.pests,
```

заменить на

```js
              c.watering_details, c.diseases, c.pests, c.soil_tips,
```

- [ ] **Step 2: Передать тип почвы участка в `getCropStageTip`**

Там же, в блоке «Совет по стадии культуры», строку

```js
          getCropStageTip(planting, planting.stage, planting.sowing_method, daysSincePlanting, planting.id) ||
```

заменить на

```js
          // Шестым аргументом — тип почвы участка: если у культуры есть текст под него,
          // к совету по стадии добавится почвенное примечание (см. soilNote в data/tips.js).
          getCropStageTip(planting, planting.stage, planting.sowing_method, daysSincePlanting, planting.id, gardenRes.rows[0].soil_type) ||
```

- [ ] **Step 3: Прогнать весь бэкенд-набор — регрессий быть не должно**

Run: `cd backend && npm test`
Expected: PASS, ни один существующий тест не покраснел.

- [ ] **Step 4: Проверить на живом сервере, что совет дня не сломался**

Run: `cd backend && npm run dev` в одном терминале; во втором — залогиниться тест-аккаунтом и дёрнуть `GET /recommendations?garden_id=<id>`.
Expected: 200, массив советов приходит как раньше — у всех культур `soil_tips` пустая, тексты идентичны прежним.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/recommendations.js
git commit -m "feat(recommendations): тип почвы участка учитывается в совете дня"
```

---

## Task 4: `PUT /gardens/:id` не затирает тип почвы

**Files:**
- Modify: `backend/src/routes/gardens.js:137-145`
- Test: `backend/src/__tests__/gardens.test.js`

- [ ] **Step 1: Написать падающий тест**

В конец `backend/src/__tests__/gardens.test.js` добавить:

```js
describe('PUT /gardens/:id — тип почвы', () => {
  it('клиент не прислал soil_type — прежнее значение сохраняется (COALESCE)', async () => {
    let updateSql = null
    let updateParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE gardens')) {
          updateSql = sql
          updateParams = params
          return { rows: [{ ...GARDEN, soil_type: 'clay' }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .put('/gardens/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Мой участок', region: 'Москва' })

    expect(res.status).toBe(200)
    expect(updateSql).toMatch(/soil_type\s*=\s*COALESCE/i)
    expect(updateParams[4]).toBeNull()
    expect(res.body.soil_type).toBe('clay')
    await app.close()
  })

  it('клиент прислал soil_type — значение записывается', async () => {
    let updateParams = null
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE gardens')) {
          updateParams = params
          return { rows: [{ ...GARDEN, soil_type: 'sandy' }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .put('/gardens/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Мой участок', region: 'Москва', soil_type: 'sandy' })

    expect(res.status).toBe(200)
    expect(updateParams[4]).toBe('sandy')
    expect(res.body.soil_type).toBe('sandy')
    await app.close()
  })
})
```

- [ ] **Step 2: Прогнать тест — убедиться, что первый падает**

Run: `cd backend && npx vitest run src/__tests__/gardens.test.js`
Expected: FAIL на «прежнее значение сохраняется» (в SQL сейчас `soil_type=$5`, без `COALESCE`); второй тест уже зелёный.

- [ ] **Step 3: Реализовать**

В `backend/src/routes/gardens.js` в обработчике `PUT /:id` строку

```js
       SET name=$1, lat=$2, lon=$3, region=$4, soil_type=$5, climate_zone=$6,
```

заменить на

```js
       -- soil_type только через COALESCE: клиенты, которые поле не шлют (в том числе уже
       -- установленные старые версии приложения), не должны обнулять выбранный тип почвы
       -- при обычной правке названия. Сброса типа продуктом не предусмотрено.
       SET name=$1, lat=$2, lon=$3, region=$4, soil_type=COALESCE($5, soil_type), climate_zone=$6,
```

и в массиве параметров строку

```js
      [name, lat, lon, region, soil_type,
```

заменить на

```js
      [name, lat, lon, region, soil_type ?? null,
```

(`undefined` драйвер `pg` в параметрах не принимает — явный `null` доедет до `COALESCE`).

- [ ] **Step 4: Прогнать тесты**

Run: `cd backend && npx vitest run src/__tests__/gardens.test.js`
Expected: PASS — оба новых теста зелёные, старые не тронуты.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/gardens.js backend/src/__tests__/gardens.test.js
git commit -m "fix(gardens): PUT не затирает soil_type, когда клиент поле не прислал"
```

---

## Task 5: Web — пикер типа почвы в форме правки участка

**Files:**
- Modify: `web/src/api/types.ts:27-39` (`Garden`), `:303-309` (`CreateGardenRequest`)
- Modify: `web/src/screens/EditGardenScreen.tsx`

- [ ] **Step 1: Добавить поле в типы**

В `web/src/api/types.ts` в интерфейсе `Garden` после строки `climate_zone?: string | null` добавить:

```ts
  // loam | sandy | clay | peat | black_earth — см. SOIL_TYPES в EditGardenScreen.
  soil_type?: string | null
```

и в `CreateGardenRequest` после `climate_zone?: string`:

```ts
  soil_type?: string
```

- [ ] **Step 2: Добавить пикер в форму**

В `web/src/screens/EditGardenScreen.tsx` перед `export default function EditGardenScreen()` добавить константу:

```ts
// Пять типов из заготовки миграции 001 — теми же ключами их читают советы дня
// (crops.soil_tips, миграция 088).
const SOIL_TYPES: { value: string; label: string }[] = [
  { value: 'loam', label: 'Суглинок' },
  { value: 'sandy', label: 'Песчаная' },
  { value: 'clay', label: 'Глинистая' },
  { value: 'peat', label: 'Торфяная' },
  { value: 'black_earth', label: 'Чернозём' },
]
```

Рядом с остальными `useState` добавить:

```ts
  const [soilType, setSoilType] = useState<string | null>(active?.soil_type ?? null)
```

В `submit` в **обе** ветки тела запроса (`picked` и не-`picked`) добавить одно и то же поле — сразу после строки с `name:`:

```ts
            soil_type: soilType ?? undefined,
```

В разметке после блока «Город» (перед `{error && …}`) добавить:

```tsx
          <label className="mt-2 text-sm font-bold text-muted">Тип почвы</label>
          <div className="flex flex-wrap gap-2">
            {SOIL_TYPES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={soilType === s.value}
                onClick={() => setSoilType(soilType === s.value ? null : s.value)}
                className={`dacha-chip ${soilType === s.value ? 'dacha-chip-active' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-muted">
            Учтём в советах дня: полив, подкормки и улучшение почвы зависят от её типа.
          </p>
```

- [ ] **Step 3: Проверить типы**

Run: `cd web && npm run typecheck`
Expected: без ошибок.

- [ ] **Step 4: Проверить руками в превью**

Run: `cd web && npm run dev` (порт 5183), открыть форму правки участка под тест-аккаунтом (`/profile` → «Аккаунт» → правка участка).
Expected: ряд из 5 чипов, выбранный подсвечен `dacha-chip-active`, повторный клик по выбранному снимает выбор; после «Сохранить» и повторного захода выбранный тип подсвечен.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/types.ts web/src/screens/EditGardenScreen.tsx
git commit -m "feat(web): выбор типа почвы в форме участка"
```

---

## Task 6: Web — общая площадь грядок в шапке «Мой участок»

**Files:**
- Modify: `web/src/screens/ProfileScreen.tsx:27-56`

- [ ] **Step 1: Добавить чистую функцию расчёта**

В `web/src/screens/ProfileScreen.tsx` дописать `GardenBed` в импорт типов:

```ts
import type { AiDiagnosisCandidate, FeedItem, GardenBed, MilestoneKind } from '../api/types'
```

и после строки `type Tab = 'feed' | 'stats' | 'account'` добавить:

```ts
// Площадь считаем только по грядкам, где заполнены ОБА размера: одна сторона без второй
// площади не даёт. Такие грядки уходят в счётчик «без размера» — вместе с грядками вовсе
// без размеров. Размеры вписываются в пикере грядок при посадке (BedField).
function bedsAreaLines(beds: GardenBed[]): { area: string | null; missing: string | null } {
  const sized = beds.filter((b) => b.width_cm != null && b.length_cm != null)
  const missing = beds.length - sized.length
  const m2 = sized.reduce((sum, b) => sum + (b.width_cm! * b.length_cm!) / 10000, 0)
  return {
    area: sized.length > 0
      ? `Грядки: ${m2.toFixed(1).replace('.', ',')} м² (${sized.length} шт.)`
      : null,
    missing: missing > 0
      ? `${missing} ${missing === 1 ? 'грядка' : 'грядок'} без размера — укажите размер при посадке`
      : null,
  }
}
```

- [ ] **Step 2: Показать строки в шапке**

Заменить тело компонента `ProfileScreen` на:

```tsx
export default function ProfileScreen() {
  const { active } = useGardens()
  const [tab, setTab] = useState<Tab>('feed')
  const [beds, setBeds] = useState<GardenBed[]>([])

  const region = [active?.city, active?.region].filter(Boolean).join(', ')

  // Грядки нужны только ради строки площади в шапке — отдельного роута для суммы нет,
  // считаем на клиенте из уже существующего списка. Ошибку глотаем: шапка без строки
  // площади лучше, чем экран с ошибкой ради второстепенной подписи.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    api.getBeds(active.id)
      .then((res) => { if (!cancelled) setBeds(res) })
      .catch(() => { if (!cancelled) setBeds([]) })
    return () => { cancelled = true }
  }, [active])

  const { area, missing } = bedsAreaLines(beds)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col">
        <h1 className="text-2xl font-black">{active?.name?.trim() || 'Мой участок'}</h1>
        {region && <span className="text-sm font-semibold text-muted">{region}</span>}
        {area && <span className="text-sm font-semibold text-muted">{area}</span>}
        {missing && <span className="text-xs font-semibold text-muted">{missing}</span>}
      </header>

      <div className="flex gap-2">
        <TabChip active={tab === 'feed'} onClick={() => setTab('feed')}>Лента</TabChip>
        <TabChip active={tab === 'stats'} onClick={() => setTab('stats')}>Статистика</TabChip>
        <TabChip active={tab === 'account'} onClick={() => setTab('account')}>Аккаунт</TabChip>
      </div>

      {tab === 'feed' && <FeedList />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'account' && <AccountTab />}
    </div>
  )
}
```

(`useEffect`, `useState` и `api` в этом файле уже импортированы.)

- [ ] **Step 3: Проверить типы**

Run: `cd web && npm run typecheck`
Expected: без ошибок.

- [ ] **Step 4: Проверить руками**

Run: `cd web && npm run dev`, открыть `/profile` под тест-аккаунтом.
Expected: под названием и городом строка «Грядки: N,N м² (K шт.)»; если есть грядки без размеров — вторая, более мелкая строка со счётчиком. У участка вовсе без грядок обе строки отсутствуют, шапка выглядит как раньше.

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/ProfileScreen.tsx
git commit -m "feat(web): общая площадь грядок в шапке «Мой участок»"
```

---

## Task 7: Android — пикер типа почвы в правке участка

Поле `soilType` в `Garden`/`UpdateGardenRequest` уже есть (`Models.kt`) — не хватает проброса через репозиторий/VM и самого инпута.

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/repository/GardenRepository.kt:64-88`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/garden/GardenEditViewModel.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/garden/GardenEditScreen.kt`

- [ ] **Step 1: Пробросить `soilType` через репозиторий**

В `GardenRepository.kt` в сигнатуре `updateGarden` последний параметр

```kotlin
        climateZone: String? = null
```

заменить на

```kotlin
        climateZone: String? = null,
        soilType: String? = null
```

и в теле, в `UpdateGardenRequest`, строку

```kotlin
                    climateZone = climateZone
```

заменить на

```kotlin
                    climateZone = climateZone,
                    soilType = soilType
```

- [ ] **Step 2: Пробросить через ViewModel**

В `GardenEditViewModel.kt` сигнатуру

```kotlin
    fun saveGarden(name: String, region: String?, city: String?, gardenType: String? = null) {
```

заменить на

```kotlin
    fun saveGarden(name: String, region: String?, city: String?, gardenType: String? = null, soilType: String? = null) {
```

и вызов репозитория

```kotlin
            when (val result = gardenRepository.updateGarden(gardenId, name, region, city, gardenType, pendingLat, pendingLon, pendingZone)) {
```

на

```kotlin
            when (val result = gardenRepository.updateGarden(gardenId, name, region, city, gardenType, pendingLat, pendingLon, pendingZone, soilType)) {
```

- [ ] **Step 3: Добавить инпут в экран**

В `GardenEditScreen.kt` перед `@OptIn(ExperimentalMaterial3Api::class)` добавить константу:

```kotlin
// Пять типов из заготовки миграции 001 — теми же ключами их читают советы дня
// (crops.soil_tips, миграция 088).
private val SOIL_TYPES = listOf(
    "loam" to "Суглинок",
    "sandy" to "Песчаная",
    "clay" to "Глинистая",
    "peat" to "Торфяная",
    "black_earth" to "Чернозём",
)
```

Рядом с остальными `remember`-состояниями (после `var cityError`) добавить:

```kotlin
    var soilType        by remember { mutableStateOf<String?>(null) }
```

В `LaunchedEffect(uiState)` внутри `if (garden != null && !formInitialized)` перед `formInitialized = true` добавить:

```kotlin
            soilType       = garden.soilType
```

После блока `RegionInputField(...)` добавить:

```kotlin
                    Text("Тип почвы", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SOIL_TYPES.forEach { (value, label) ->
                            FilterChip(
                                selected = soilType == value,
                                // Повторный тап по выбранному — снять выбор.
                                onClick = { soilType = if (soilType == value) null else value },
                                label = { Text(label) },
                                enabled = !isSaving
                            )
                        }
                    }
                    Text(
                        "Учтём в советах дня: полив, подкормки и улучшение почвы зависят от её типа.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
```

В `onClick` кнопки «Сохранить» строку

```kotlin
                                viewModel.saveGarden(gardenName, selectedRegion.ifBlank { null }, cityName.ifBlank { null })
```

заменить на

```kotlin
                                viewModel.saveGarden(gardenName, selectedRegion.ifBlank { null }, cityName.ifBlank { null }, soilType = soilType)
```

Дописать импорты в шапку файла:

```kotlin
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.ui.text.font.FontWeight
import ru.dachakalend.app.ui.theme.NunitoFamily
```

и расширить opt-in у `GardenEditScreen`:

```kotlin
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
```

- [ ] **Step 4: Собрать**

Run: `cd android && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Проверить на устройстве/эмуляторе**

Открыть «Профиль» → «Аккаунт» → «Изменить участок».
Expected: ряд из 5 чипов, выбор подсвечивается и снимается повторным тапом; после «Сохранить» и повторного захода на экран выбранный тип подсвечен.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/repository/GardenRepository.kt android/app/src/main/java/ru/dachakalend/app/ui/garden/GardenEditViewModel.kt android/app/src/main/java/ru/dachakalend/app/ui/garden/GardenEditScreen.kt
git commit -m "feat(android): выбор типа почвы в правке участка"
```

---

## Task 8: Android — общая площадь грядок в шапке профиля

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/profile/ProfileScreen.kt:56-134`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/profile/FeedViewModel.kt:18-51`
- Test: `android/app/src/test/java/ru/dachakalend/app/profile/BedsAreaTest.kt`

- [ ] **Step 1: Написать падающий тест**

Создать `android/app/src/test/java/ru/dachakalend/app/profile/BedsAreaTest.kt`:

```kotlin
package ru.dachakalend.app.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.profile.bedsAreaLines

class BedsAreaTest {

    private fun bed(id: Int, widthCm: Int?, lengthCm: Int?) =
        GardenBed(id = id, gardenId = 12, name = "Грядка $id", type = "soil", widthCm = widthCm, lengthCm = lengthCm)

    @Test
    fun `грядок нет — обе строки пустые`() {
        val lines = bedsAreaLines(emptyList())
        assertNull(lines.area)
        assertNull(lines.missing)
    }

    @Test
    fun `суммируются только грядки с обоими размерами`() {
        val lines = bedsAreaLines(listOf(bed(1, 100, 300), bed(2, 100, 200)))
        assertEquals("Грядки: 5,0 м² (2 шт.)", lines.area)
        assertNull(lines.missing)
    }

    @Test
    fun `грядка с одним размером идёт в счётчик без размера, а не в площадь`() {
        val lines = bedsAreaLines(listOf(bed(1, 100, 300), bed(2, 100, null), bed(3, null, null)))
        assertEquals("Грядки: 3,0 м² (1 шт.)", lines.area)
        assertEquals("2 грядок без размера — укажите размер при посадке", lines.missing)
    }

    @Test
    fun `одна грядка без размера — единственное число`() {
        val lines = bedsAreaLines(listOf(bed(1, null, null)))
        assertNull(lines.area)
        assertEquals("1 грядка без размера — укажите размер при посадке", lines.missing)
    }
}
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd android && ./gradlew test --tests "*BedsAreaTest*"`
Expected: FAIL — компиляция падает на `unresolved reference: bedsAreaLines`.

- [ ] **Step 3: Реализовать чистую функцию**

В `ProfileScreen.kt` после `private fun feedDateShort(...)` добавить:

```kotlin
/** Строки площади для шапки профиля: сумма и счётчик грядок без размеров. */
data class BedsAreaLines(val area: String?, val missing: String?)

// Площадь считаем только по грядкам, где заполнены ОБА размера: одна сторона без второй
// площади не даёт. Такие грядки уходят в счётчик «без размера» — вместе с грядками вовсе
// без размеров. Размеры вписываются в пикере грядок при посадке (BedPickerField).
// Локаль форматирования не фиксируем: точку заменяем на запятую явно.
fun bedsAreaLines(beds: List<ru.dachakalend.app.data.model.GardenBed>): BedsAreaLines {
    val sized = beds.filter { it.widthCm != null && it.lengthCm != null }
    val missing = beds.size - sized.size
    val m2 = sized.sumOf { (it.widthCm!! * it.lengthCm!!) / 10000.0 }
    return BedsAreaLines(
        area = if (sized.isNotEmpty())
            "Грядки: %.1f м² (%d шт.)".format(java.util.Locale.US, m2, sized.size).replace('.', ',')
        else null,
        missing = if (missing > 0)
            "$missing ${if (missing == 1) "грядка" else "грядок"} без размера — укажите размер при посадке"
        else null,
    )
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что проходит**

Run: `cd android && ./gradlew test --tests "*BedsAreaTest*"`
Expected: PASS.

- [ ] **Step 5: Загрузить грядки во ViewModel**

В `FeedViewModel.kt` в `data class FeedUiState` после `gardenRegion` добавить:

```kotlin
    val bedsArea: String? = null,    // шапка профиля: сумма площадей грядок
    val bedsMissing: String? = null, // шапка профиля: сколько грядок без размера
```

В конструктор `FeedViewModel` после `actionsRepository` добавить зависимость:

```kotlin
    private val bedsRepository: ru.dachakalend.app.data.repository.BedsRepository,
```

и заменить `loadGarden()` на:

```kotlin
    private fun loadGarden() {
        viewModelScope.launch {
            (gardenRepository.loadGardens() as? Result.Success)?.data?.firstOrNull()?.let { g ->
                _uiState.value = _uiState.value.copy(gardenName = g.name, gardenRegion = g.region)
                // Грядки нужны только ради строки площади в шапке — отдельного роута для
                // суммы нет, считаем на клиенте. Ошибку глотаем: шапка без строки площади
                // лучше, чем экран с ошибкой ради второстепенной подписи.
                val beds = (bedsRepository.getBeds(g.id) as? Result.Success)?.data ?: return@let
                val lines = ru.dachakalend.app.ui.profile.bedsAreaLines(beds)
                _uiState.value = _uiState.value.copy(bedsArea = lines.area, bedsMissing = lines.missing)
            }
        }
    }
```

- [ ] **Step 6: Показать строки в шапке**

В `ProfileScreen.kt` вызов

```kotlin
            ProfileHeader(state.gardenName, state.gardenRegion)
```

заменить на

```kotlin
            ProfileHeader(state.gardenName, state.gardenRegion, state.bedsArea, state.bedsMissing)
```

и саму `ProfileHeader` на:

```kotlin
@Composable
private fun ProfileHeader(name: String?, region: String?, bedsArea: String? = null, bedsMissing: String? = null) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        Text(
            name?.takeIf { it.isNotBlank() } ?: "Мой участок",
            fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 26.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        region?.takeIf { it.isNotBlank() }?.let {
            Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        bedsArea?.let {
            Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        bedsMissing?.let {
            Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
```

- [ ] **Step 7: Собрать и прогнать весь тестовый набор**

Run: `cd android && ./gradlew test assembleDebug`
Expected: BUILD SUCCESSFUL, все юнит-тесты зелёные. Если какой-то существующий тест конструирует `FeedViewModel` напрямую — добавить в него мок `BedsRepository`, возвращающий `Result.Success(emptyList())`.

- [ ] **Step 8: Проверить на устройстве/эмуляторе**

Открыть вкладку «Профиль».
Expected: под названием и регионом строка площади и (если есть) счётчик грядок без размеров; у участка без грядок шапка выглядит как раньше.

- [ ] **Step 9: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/profile/ProfileScreen.kt android/app/src/main/java/ru/dachakalend/app/ui/profile/FeedViewModel.kt android/app/src/test/java/ru/dachakalend/app/profile/BedsAreaTest.kt
git commit -m "feat(android): общая площадь грядок в шапке профиля"
```

---

## Task 9: Документация

**Files:**
- Modify: `docs/ux-roadmap.md:175-181`
- Modify: `session-note.md`, `summary.md`

- [ ] **Step 1: Обновить §5.1 в roadmap**

В `docs/ux-roadmap.md` заменить пункт `- [~] §5.1 — «площадь» и «тип почвы». …` (строки 175–181) на:

```markdown
- [x] §5.1 — «площадь» и «тип почвы» — **МЕХАНИЗМ РЕАЛИЗОВАН 2026-09-02**. `gardens.area_m2`
      вычеркнута как избыточная (вместимость считается на уровне грядки, миграции 070/071).
      Вместо неё — «общая площадь грядок»: сумма уже введённых размеров + счётчик грядок без
      размера в шапке «Мой участок» (web `ProfileScreen.tsx`, Android `ProfileScreen.kt`),
      без новых роутов. Тип почвы: пикер из 5 значений в правке участка на обеих платформах,
      колонка `crops.soil_tips` (миграция 088) и подмешивание почвенного примечания в
      культуро-специфичный совет дня (`data/tips.js`, `soilNote`). Нет типа почвы у участка
      или текста под него — поведение ровно прежнее.
      Дизайн: `docs/superpowers/specs/2026-09-02-garden-area-soil-tips-design.md`,
      план: `docs/superpowers/plans/2026-09-02-garden-area-soil-tips.md`.
      **Открыто:** `soil_tips` в проде пустая — контент (67 культур × 5 типов) пишется
      отдельными батчами с проверкой по 2+ источникам, как справочник болезней (081/082).
      До наполнения пользователь видит только сам пикер, тексты советов не меняются.
      **Отклонение:** подсказка «N грядок без размера» — текст без перехода: отдельного
      экрана грядок нет ни на одной платформе, пикер живёт внутри формы посадки.
```

- [ ] **Step 2: Дописать `session-note.md` и `summary.md`**

В `session-note.md` — запись о сессии в том же формате, что соседние: дата, что сделано (миграция 088, почвенное примечание в совете дня, пикер почвы web+Android, площадь грядок в шапке, `COALESCE` в PUT), что открыто (`soil_tips` пустая, контент отдельным этапом). В `summary.md` — строка о фиче в разделе реализованного, форматом соседних пунктов.

- [ ] **Step 3: Commit**

```bash
git add docs/ux-roadmap.md session-note.md summary.md
git commit -m "docs: §5.1 — механизм площади грядок и советов по почве реализован"
```

---

## Финальная проверка

- [ ] `cd backend && npm test` — зелёный
- [ ] `cd web && npm run typecheck && npm run build` — без ошибок
- [ ] `cd android && ./gradlew test assembleDebug` — BUILD SUCCESSFUL
- [ ] `GET /recommendations` на тест-аккаунте отдаёт советы, идентичные прежним (`soil_tips` пустая)
- [ ] Деплой и релиз — только по отдельной просьбе владельца; миграция 088 едет вместе с бэкендом (`DEPLOY.md`)
