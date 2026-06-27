# Грядки участка + севооборот — план реализации (БЭКЕНД)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать бэкенду таблицу грядок участка, эндпоинты CRUD для них, ботаническое семейство у культур
и поддержку `bed_id` у посадок — фундамент, на который лягут Android- и веб-планы (отдельные документы).

**Architecture:** Новая таблица `garden_beds` (принадлежит участку) + новая колонка `crops.family` +
новая nullable колонка `plantings.bed_id`. Новый файл маршрутов `routes/beds.js` (PATCH/DELETE по
`/beds/:id`) + два новых вложенных маршрута в существующем `routes/gardens.js` (`GET/POST
/gardens/:id/beds`, история на 3 года встроена в ответ списка грядок). `routes/plantings.js` — принимает
опциональный `bed_id` на создании/правке.

**Tech Stack:** Fastify, PostgreSQL (raw SQL через `fastify.db.query`), vitest + supertest (см.
`backend/src/__tests__/helpers/buildApp.js`).

**Связанная спека:** `docs/superpowers/specs/2026-06-27-garden-beds-rotation-design.md`

---

### Task 1: Миграции — таблица грядок, `bed_id`, `crops.family`

**Files:**
- Create: `backend/src/db/migrations/052_garden_beds.sql`
- Create: `backend/src/db/migrations/053_crop_family.sql`

- [ ] **Step 1: Написать миграцию 052**

```sql
-- 052_garden_beds.sql
-- Грядки участка: именованное место (грунт/теплица), к которому можно привязать посадку.
-- Нужно для подсказки севооборота по ботаническому семейству (см. 053).

CREATE TABLE IF NOT EXISTS garden_beds (
  id         SERIAL PRIMARY KEY,
  garden_id  INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'soil' CHECK (type IN ('soil', 'greenhouse')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Написать миграцию 053 (семейства культур, backfill всех 55)**

```sql
-- 053_crop_family.sql
-- Ботаническое семейство культуры — нужно для подсказки севооборота (сравнение по грядке за 3 года).

ALTER TABLE crops ADD COLUMN IF NOT EXISTS family TEXT;

UPDATE crops SET family = 'Паслёновые' WHERE id IN (1, 3, 5, 13, 21, 190);   -- Томат, Перец, Баклажан, Картофель, Петуния, Перец острый
UPDATE crops SET family = 'Тыквенные' WHERE id IN (2, 4, 169, 170, 188, 189); -- Огурец, Кабачок, Тыква, Патиссон, Арбуз, Дыня
UPDATE crops SET family = 'Крестоцветные' WHERE id IN (6, 11, 171, 172, 173, 174, 175, 191); -- Капуста б/к, Редис, Цветная/Брокколи/Пекинская, Редька, Репа, Хрен
UPDATE crops SET family = 'Зонтичные' WHERE id IN (7, 14, 15, 17, 183, 193); -- Морковь, Укроп, Петрушка, Кинза, Сельдерей, Пастернак
UPDATE crops SET family = 'Маревые' WHERE id IN (8, 178);                    -- Свёкла, Шпинат
UPDATE crops SET family = 'Луковые' WHERE id IN (9, 10, 176, 177);           -- Лук репчатый, Чеснок, Лук-порей, Лук-батун
UPDATE crops SET family = 'Астровые' WHERE id IN (12, 20);                   -- Салат листовой, Бархатцы
UPDATE crops SET family = 'Яснотковые' WHERE id IN (16, 184, 185);          -- Базилик, Мята, Тимьян
UPDATE crops SET family = 'Розоцветные' WHERE id IN (18, 19, 518, 520, 521, 522, 523, 524); -- Клубника, Малина, Ежевика, Яблоня, Груша, Вишня, Черешня, Слива
UPDATE crops SET family = 'Гречишные' WHERE id IN (179, 192);               -- Щавель, Ревень
UPDATE crops SET family = 'Бобовые' WHERE id IN (180, 181);                 -- Горох, Фасоль стручковая
UPDATE crops SET family = 'Злаковые' WHERE id IN (182);                     -- Кукуруза
UPDATE crops SET family = 'Крыжовниковые' WHERE id IN (186, 187, 516, 517); -- Смородина чёрная/красная/белая, Крыжовник
UPDATE crops SET family = 'Жимолостные' WHERE id IN (519);                  -- Жимолость съедобная
```

- [ ] **Step 3: Прогнать обе миграции локально на дев-БД и проверить покрытие**

Run (подставить актуальные DSN/окружение проекта — как обычно гоняются миграции локально):
```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/052_garden_beds.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/053_crop_family.sql
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM crops WHERE family IS NULL;"
```
Expected: обе миграции проходят без ошибок, последний запрос возвращает `0` (все 55 культур размечены).

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/052_garden_beds.sql backend/src/db/migrations/053_crop_family.sql
git commit -m "Add garden_beds table, plantings.bed_id, crops.family"
```

---

### Task 2: `routes/beds.js` — PATCH/DELETE грядки

**Files:**
- Create: `backend/src/routes/beds.js`
- Modify: `backend/src/app.js` (регистрация роута)
- Modify: `backend/src/__tests__/helpers/buildApp.js` (регистрация роута в тестовом приложении)
- Test: `backend/src/__tests__/beds.test.js`

- [ ] **Step 1: Зарегистрировать роут в `app.js` и `buildApp.js` (заранее, чтобы тест ниже не упал на "не найден модуль")**

В `backend/src/app.js`, рядом со строкой `app.register(require('./routes/gardens'), { prefix: '/gardens' })` (строка 100) добавить:
```js
app.register(require('./routes/beds'), { prefix: '/beds' })
```

В `backend/src/__tests__/helpers/buildApp.js`, рядом со строкой `fastify.register(require('../../routes/gardens'),   { prefix: '/gardens' })` (строка 64) добавить:
```js
  fastify.register(require('../../routes/beds'),     { prefix: '/beds' })
```

- [ ] **Step 2: Написать падающий тест**

Создать `backend/src/__tests__/beds.test.js`:
```js
'use strict'

const supertest = require('supertest')
const { buildApp, makeToken } = require('./helpers/buildApp')

const GARDEN = { id: 1, user_id: 1 }
const BED = { id: 10, garden_id: 1, name: 'Теплица 1', type: 'greenhouse' }

function makeMockDb(overrides = {}) {
  return { query: async () => ({ rows: [] }), ...overrides }
}

describe('PATCH /beds/:id', () => {
  it('переименовывает грядку своего участка', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        if (sql.includes('UPDATE garden_beds')) {
          return { rows: [{ ...BED, name: params[0] }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/beds/10')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка у забора' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Грядка у забора')
    await app.close()
  })

  it('404 для чужой грядки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .patch('/beds/999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Чужая' })

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('DELETE /beds/:id', () => {
  it('удаляет грядку своего участка', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => sql.includes('DELETE') ? { rows: [{ id: 10 }] } : { rows: [] },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/beds/10')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true })
    await app.close()
  })

  it('404 для чужой грядки', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .delete('/beds/999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

Run: `cd backend && npx vitest run src/__tests__/beds.test.js`
Expected: FAIL — `Cannot find module '../../routes/beds'`

- [ ] **Step 4: Написать `routes/beds.js`**

```js
'use strict'

module.exports = async function (fastify) {
  const auth = { onRequest: [fastify.authenticate] }

  // PATCH /beds/:id — переименовать/сменить тип грядки своего участка
  fastify.patch('/:id', auth, async (request, reply) => {
    const { name, type } = request.body
    const bedType = type === undefined ? null : (type === 'greenhouse' ? 'greenhouse' : 'soil')
    const result = await fastify.db.query(
      `UPDATE garden_beds SET name = COALESCE($1, name), type = COALESCE($2, type)
       WHERE id = $3 AND garden_id IN (SELECT id FROM gardens WHERE user_id = $4)
       RETURNING *`,
      [name ?? null, bedType, request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Bed not found' })
    return result.rows[0]
  })

  // DELETE /beds/:id — посадки, привязанные к грядке, не удаляются (ON DELETE SET NULL)
  fastify.delete('/:id', auth, async (request, reply) => {
    const result = await fastify.db.query(
      `DELETE FROM garden_beds WHERE id = $1
       AND garden_id IN (SELECT id FROM gardens WHERE user_id = $2)
       RETURNING id`,
      [request.params.id, request.user.userId]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Bed not found' })
    return reply.code(200).send({ deleted: true })
  })
}
```

- [ ] **Step 5: Запустить тест, убедиться что проходит**

Run: `cd backend && npx vitest run src/__tests__/beds.test.js`
Expected: PASS (4/4)

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/beds.js backend/src/app.js backend/src/__tests__/helpers/buildApp.js backend/src/__tests__/beds.test.js
git commit -m "Add PATCH/DELETE /beds/:id"
```

---

### Task 3: `GET/POST /gardens/:id/beds` — список с историей, создание

**Files:**
- Modify: `backend/src/routes/gardens.js`
- Test: `backend/src/__tests__/gardens.test.js` (если файла нет — создать)

- [ ] **Step 1: Написать падающие тесты**

Файл `backend/src/__tests__/gardens.test.js` уже существует (есть тесты `POST /gardens`, `GET
/gardens`, `PUT /gardens/:id`) и уже импортирует `supertest`, `buildApp`/`makeToken`, имеет фикстуру
`GARDEN` и хелпер `makeMockDb` — используем их же. Добавить в конец файла:

```js
describe('GET /gardens/:id/beds', () => {
  it('возвращает грядки участка с историей посадок за 3 года', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM gardens')) return { rows: [{ id: 1 }] }
        if (sql.includes('FROM garden_beds')) {
          return { rows: [{ id: 10, name: 'Теплица 1', type: 'greenhouse', history: [
            { crop_name: 'Томат', family: 'Паслёновые', year: 2025 },
          ] }] }
        }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/1/beds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body[0]).toMatchObject({ name: 'Теплица 1' })
    expect(res.body[0].history[0]).toMatchObject({ crop_name: 'Томат', family: 'Паслёновые' })
    await app.close()
  })

  it('404 для чужого участка', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .get('/gardens/999/beds')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    await app.close()
  })
})

describe('POST /gardens/:id/beds', () => {
  it('создаёт грядку в своём участке', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT id FROM gardens')) return { rows: [{ id: 1 }] }
        if (sql.includes('INSERT INTO garden_beds')) return { rows: [{ id: 10, garden_id: 1, name: 'Грядка 1', type: 'soil' }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens/1/beds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка 1', type: 'soil' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Грядка 1', history: [] })
    await app.close()
  })

  it('403/404 при создании грядки в чужом участке', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)

    const res = await supertest(app.server)
      .post('/gardens/999/beds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Грядка', type: 'soil' })

    expect(res.status).toBe(404)
    await app.close()
  })
})
```

Если `gardens.test.js` ещё не существует — добавить в начало файла такой же импорт-блок, как в
`plantings.test.js` (`supertest`, `buildApp`/`makeToken`, локальный `makeMockDb`).

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd backend && npx vitest run src/__tests__/gardens.test.js`
Expected: FAIL — `/gardens/1/beds` возвращает 404 (роута нет) на тестах, где ожидается 200/201.

- [ ] **Step 3: Добавить роуты в `routes/gardens.js`**

В конец `module.exports = async function (fastify) { ... }` (перед закрывающей `}` файла, после
существующего `PUT /:id`) добавить:

```js
  // GET /gardens/:id/beds — грядки участка + история посадок за 3 года (для подсказки севооборота)
  fastify.get('/:id/beds', auth, async (request, reply) => {
    const garden = await fastify.db.query(
      'SELECT id FROM gardens WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!garden.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    const result = await fastify.db.query(
      `SELECT b.id, b.name, b.type,
              COALESCE((
                SELECT json_agg(json_build_object(
                         'crop_name', c.name, 'family', c.family,
                         'year', EXTRACT(YEAR FROM p.planted_at)::int
                       ) ORDER BY p.planted_at DESC)
                FROM plantings p
                JOIN crops c ON c.id = p.crop_id
                WHERE p.bed_id = b.id AND p.planted_at >= NOW() - INTERVAL '3 years'
              ), '[]'::json) AS history
       FROM garden_beds b
       WHERE b.garden_id = $1
       ORDER BY b.created_at ASC`,
      [request.params.id]
    )
    return result.rows
  })

  // POST /gardens/:id/beds — создать грядку
  fastify.post('/:id/beds', auth, async (request, reply) => {
    const garden = await fastify.db.query(
      'SELECT id FROM gardens WHERE id = $1 AND user_id = $2',
      [request.params.id, request.user.userId]
    )
    if (!garden.rows[0]) return reply.code(404).send({ error: 'Garden not found' })

    const { name, type } = request.body
    const bedType = type === 'greenhouse' ? 'greenhouse' : 'soil'
    const result = await fastify.db.query(
      'INSERT INTO garden_beds (garden_id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [request.params.id, name, bedType]
    )
    return reply.code(201).send({ ...result.rows[0], history: [] })
  })
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `cd backend && npx vitest run src/__tests__/gardens.test.js`
Expected: PASS (все тесты файла, включая 4 новых)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/gardens.js backend/src/__tests__/gardens.test.js
git commit -m "Add GET/POST /gardens/:id/beds with 3-year rotation history"
```

---

### Task 4: `plantings.js` — принимать `bed_id`

**Files:**
- Modify: `backend/src/routes/plantings.js`
- Modify: `backend/src/__tests__/plantings.test.js`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `describe('POST /plantings', ...)` в `backend/src/__tests__/plantings.test.js`:
```js
  it('принимает bed_id и проверяет, что грядка принадлежит тому же участку', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
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
```

Добавить в `describe('GET /plantings', ...)` после существующего теста про `next_care_task`:
```js
  it('PATCH /:id/info обновляет bed_id (COALESCE — без bed_id в body значение не трогается)', async () => {
    const app = await buildApp(makeMockDb({
      query: async () => ({ rows: [{ ...PLANTING, bed_id: 10 }] }),
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
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd backend && npx vitest run src/__tests__/plantings.test.js`
Expected: FAIL — `bed_id` не принимается/не проверяется (новые тесты падают на assertions).

- [ ] **Step 3: Изменить `POST /` в `routes/plantings.js`**

Заменить текущий блок (строки 18–34 файла):
```js
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async (request, reply) => {
    const { garden_id, crop_id, planted_at, quantity = 1, conditions = 'soil', notes, sowing_method = 'seedling', variety } = request.body
    const method = sowing_method === 'direct' ? 'direct' : 'seedling'
    const varietyVal = typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : null

    // Защита от IDOR: нельзя создать посадку в чужом участке
    if (!garden_id || !(await userOwnsGarden(garden_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Garden not found or not yours' })
    }

    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, conditions, notes, stage, sowing_method, variety)
       VALUES ($1,$2,$3,$4,$5,$6,'sowing',$7,$8) RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, conditions, notes, method, varietyVal]
    )
    return reply.code(201).send(result.rows[0])
  })
```
на:
```js
  fastify.post('/', { onRequest: [fastify.authenticate, fastify.requireAccess] }, async (request, reply) => {
    const { garden_id, crop_id, planted_at, quantity = 1, conditions = 'soil', notes, sowing_method = 'seedling', variety, bed_id } = request.body
    const method = sowing_method === 'direct' ? 'direct' : 'seedling'
    const varietyVal = typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : null

    // Защита от IDOR: нельзя создать посадку в чужом участке
    if (!garden_id || !(await userOwnsGarden(garden_id, request.user.userId))) {
      return reply.code(403).send({ error: 'Garden not found or not yours' })
    }

    // Грядка (если указана) должна принадлежать тому же участку — иначе подсказка севооборота
    // могла бы сравнивать историю чужого/другого участка.
    if (bed_id != null) {
      const bedCheck = await fastify.db.query(
        'SELECT 1 FROM garden_beds WHERE id = $1 AND garden_id = $2',
        [bed_id, garden_id]
      )
      if (!bedCheck.rows[0]) return reply.code(400).send({ error: 'Invalid bed' })
    }

    const result = await fastify.db.query(
      `INSERT INTO plantings (garden_id, crop_id, planted_at, quantity, conditions, notes, stage, sowing_method, variety, bed_id)
       VALUES ($1,$2,$3,$4,$5,$6,'sowing',$7,$8,$9) RETURNING *`,
      [garden_id, crop_id, planted_at || new Date(), quantity, conditions, notes, method, varietyVal, bed_id ?? null]
    )
    return reply.code(201).send(result.rows[0])
  })
```

- [ ] **Step 4: Изменить `PATCH /:id/info` в `routes/plantings.js`**

Заменить текущий блок (метод `fastify.patch('/:id/info', ...)`, ближе к концу файла):
```js
  fastify.patch('/:id/info', auth, async (request, reply) => {
    const { planted_at, quantity, conditions, sowing_method, variety } = request.body
    const method = sowing_method === 'direct' || sowing_method === 'seedling' ? sowing_method : null
    // variety: строка → обрезаем; пустая строка '' → сброс в NULL; undefined → не трогаем.
    const varietyVal = variety === undefined
      ? null
      : (typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : '')
    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    const result = await fastify.db.query(
      `UPDATE plantings
       SET planted_at    = COALESCE($1, planted_at),
           quantity      = COALESCE($2, quantity),
           conditions    = COALESCE($3, conditions),
           sowing_method = COALESCE($4, sowing_method),
           variety       = CASE WHEN $7::text IS NULL THEN variety
                                WHEN $7 = '' THEN NULL
                                ELSE $7 END,
           updated_at    = NOW()
       WHERE id = $5 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$6)
       RETURNING *`,
      [planted_at ?? null, quantity ?? null, conditions ?? null, method, request.params.id, request.user.userId, varietyVal]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
```
на (добавлены `bed_id` в деструктуризацию, `bed_id = COALESCE($8, bed_id)` в SET и параметр `$8`):
```js
  fastify.patch('/:id/info', auth, async (request, reply) => {
    const { planted_at, quantity, conditions, sowing_method, variety, bed_id } = request.body
    const method = sowing_method === 'direct' || sowing_method === 'seedling' ? sowing_method : null
    // variety: строка → обрезаем; пустая строка '' → сброс в NULL; undefined → не трогаем.
    const varietyVal = variety === undefined
      ? null
      : (typeof variety === 'string' && variety.trim() ? variety.trim().slice(0, 120) : '')
    // Защита от IDOR: обновляем только посадку в участке текущего пользователя
    const result = await fastify.db.query(
      `UPDATE plantings
       SET planted_at    = COALESCE($1, planted_at),
           quantity      = COALESCE($2, quantity),
           conditions    = COALESCE($3, conditions),
           sowing_method = COALESCE($4, sowing_method),
           variety       = CASE WHEN $7::text IS NULL THEN variety
                                WHEN $7 = '' THEN NULL
                                ELSE $7 END,
           bed_id        = COALESCE($8, bed_id),
           updated_at    = NOW()
       WHERE id = $5 AND garden_id IN (SELECT id FROM gardens WHERE user_id=$6)
       RETURNING *`,
      [planted_at ?? null, quantity ?? null, conditions ?? null, method, request.params.id, request.user.userId, varietyVal, bed_id ?? null]
    )
    if (!result.rows[0]) return reply.code(404).send({ error: 'Planting not found' })
    return result.rows[0]
  })
```

(Сознательно не делаем явный сброс «убрать привязку к грядке» через сентинел, как у `variety` — это не
требовалось в спеке (YAGNI); при необходимости такая фича добавляется отдельным шагом по аналогии.)

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `cd backend && npx vitest run src/__tests__/plantings.test.js`
Expected: PASS (все тесты файла, включая 3 новых)

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/plantings.js backend/src/__tests__/plantings.test.js
git commit -m "Accept bed_id on planting create/update, validate it belongs to the garden"
```

---

### Task 5: Полный прогон тестов и деплой

**Files:** нет новых — финальная проверка.

- [ ] **Step 1: Прогнать весь бэкенд-набор**

Run: `cd backend && npm test`
Expected: все файлы зелёные (текущая база — 371 прошедших + новые из Task 2–4).

- [ ] **Step 2: Деплой на VPS**

```bash
git push origin main
ssh hetzner "cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main"
ssh hetzner "sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/052_garden_beds.sql"
ssh hetzner "sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/053_crop_family.sql"
ssh hetzner "pm2 restart dacha-api --update-env"
```

- [ ] **Step 3: Проверить на проде**

```bash
ssh hetzner "sudo -u postgres psql -d dacha_db -t -c \"SELECT COUNT(*) FROM crops WHERE family IS NULL;\""
```
Expected: `0`

---

## Self-review

- **Покрытие спеки:** данные (Task 1), API грядок (Task 2–3), `bed_id` на посадках (Task 4) — все
  пункты раздела «1. Данные» / «2. API» спеки покрыты. Разделы «3. UI-флоу» и «4. Контент» —
  семейства покрыты в Task 1; UI — в следующих (Android/веб) планах, как договорились при разбиении.
- **Плейсхолдеров нет** — каждый код-блок исполняемый, без TODO.
- **Согласованность имён:** `bed_id`, `garden_beds`, `crops.family` — одинаково во всех тасках.
- **Граница 3 лет:** `planted_at >= NOW() - INTERVAL '3 years'` — включительно, как в спеке.
