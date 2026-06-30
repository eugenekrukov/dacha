# П4 «Аккаунт и безопасность» (A+B+E) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю удаление аккаунта, смену пароля и email, и блок «О приложении» — на backend, web и Android.

**Architecture:** Новые роуты в существующем `routes/auth.js` (Fastify); каскадное удаление через FK, `payments` анонимизируется (`user_id=NULL`); смена email — verify-first через `users.pending_email`. Web и Android зеркалят друг друга: api-слой → модалки/диалоги с подтверждением паролем. Спек: `docs/superpowers/specs/2026-06-15-account-security-settings-design.md`.

**Tech Stack:** Node 20 + Fastify 4 + PostgreSQL + bcrypt + vitest/supertest (backend); React 18 + Vite + TS + Tailwind (web); Kotlin + Compose + Hilt + Retrofit (Android).

---

## File Structure

**Backend:**
- Create: `backend/src/db/migrations/036_account_management.sql` — `pending_email` + FK payments.
- Modify: `backend/src/routes/auth.js` — 4 новых роута + `pending_email` в `/me`.
- Modify: `backend/src/__tests__/auth.test.js` — тесты новых роутов.

**Web:**
- Modify: `web/src/api/types.ts` — `pending_email` в `UserProfile`.
- Modify: `web/src/api/client.ts` — 4 метода.
- Create: `web/src/components/ChangePasswordModal.tsx`
- Create: `web/src/components/ChangeEmailModal.tsx`
- Create: `web/src/components/DeleteAccountModal.tsx`
- Modify: `web/src/screens/SettingsScreen.tsx` — кнопки в «Аккаунт» + секция «О приложении».

**Android:**
- Modify: `android/.../data/api/DachaApi.kt` — 4 метода.
- Modify: `android/.../data/repository/AuthRepository.kt` — 4 метода + парсер ошибок.
- Modify: `android/.../ui/settings/SettingsViewModel.kt` — состояние + функции.
- Modify: `android/.../ui/settings/SettingsScreen.kt` — секции «АККАУНТ» и «О ПРИЛОЖЕНИИ» + 3 диалога.

**Тон/паттерны:** backend — стиль `routes/auth.js` (issueCode/findValidCode уже есть); web — `dacha-card`, `text-link`, `dacha-btn`, `dacha-chip`; Android — `NunitoFamily`, `Card(RoundedCornerShape(16.dp))`, `AlertDialog`.

---

## Task 1: Миграция 036 (pending_email + payments FK)

**Files:**
- Create: `backend/src/db/migrations/036_account_management.sql`

- [ ] **Step 1: Создать миграцию**

```sql
-- 036_account_management.sql
-- П4: управление аккаунтом. Идемпотентно. На проде применять ТОЧЕЧНО как app-юзер
-- (payments принадлежит dacha_user; готча владельца 009 не мешает — чистые ALTER).

-- Буфер для verify-first смены email
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);

-- payments: при удалении аккаунта строки сохраняем (чеки НПД), анонимизируя user_id.
-- Было: user_id NOT NULL ... ON DELETE CASCADE (миграция 024).
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Прогнать всю цепочку на временной БД (как делали для 028/029)**

Run (PowerShell, на VPS или локально с pg):
```
createdb dacha_migrate_test && npm run migrate  # ожидаем дойти до 036 без ошибок
```
Expected: миграция 036 применяется без ошибок; `\d payments` показывает `user_id` nullable + FK `ON DELETE SET NULL`. Затем `dropdb dacha_migrate_test`.

> Если полная цепочка падает на 009 (готча владельца) — применить только 036 точечно: `psql -d <db> -f .../036_account_management.sql`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/036_account_management.sql
git commit -m "feat(db): миграция 036 — pending_email + payments FK ON DELETE SET NULL"
```

---

## Task 2: PATCH /auth/password (смена пароля)

**Files:**
- Modify: `backend/src/routes/auth.js` (добавить роут перед закрывающей `}` модуля)
- Test: `backend/src/__tests__/auth.test.js`

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `auth.test.js`:
```js
describe('PATCH /auth/password', () => {
  const bcrypt = require('bcrypt')

  it('верный текущий пароль → 200 + ok', async () => {
    const hash = await bcrypt.hash('oldpass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldpass', new_password: 'newpass123' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('неверный текущий пароль → 401', async () => {
    const hash = await bcrypt.hash('oldpass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'wrong', new_password: 'newpass123' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('новый пароль < 6 → 400', async () => {
    const app = await buildApp(makeMockDb())
    const token = makeToken(app)
    const res = await supertest(app.server)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'oldpass', new_password: '123' })
    expect(res.status).toBe(400)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).patch('/auth/password').send({ current_password: 'a', new_password: 'bbbbbb' })
    expect(res.status).toBe(401)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "PATCH /auth/password"`
Expected: FAIL (404/нет роута).

- [ ] **Step 3: Реализовать роут** в `auth.js` (перед последней `}` функции модуля)

```js
  // PATCH /auth/password — смена пароля залогиненным (нужно знать текущий).
  fastify.patch('/password', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['current_password', 'new_password'],
        properties: {
          current_password: { type: 'string' },
          new_password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [request.user.userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(request.body.current_password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    const hash = await bcrypt.hash(request.body.new_password, 10)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, request.user.userId])
    return { ok: true }
  })
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "PATCH /auth/password"`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.js backend/src/__tests__/auth.test.js
git commit -m "feat(auth): PATCH /auth/password — смена пароля"
```

---

## Task 3: POST /auth/change-email (шаг 1 — запрос кода)

**Files:**
- Modify: `backend/src/routes/auth.js`
- Test: `backend/src/__tests__/auth.test.js`

- [ ] **Step 1: Написать падающие тесты**

```js
describe('POST /auth/change-email', () => {
  const bcrypt = require('bcrypt')

  function appWith(emailFree, passOk = true) {
    return buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT email, password_hash FROM users'))
          return { rows: [{ email: 'old@test.com', password_hash: bcryptHash }] }
        if (sql.includes('SELECT id FROM users WHERE email'))
          return { rows: emailFree ? [] : [{ id: 99 }] }
        return { rows: [] }  // UPDATE users / email_codes
      },
    }))
  }
  let bcryptHash
  beforeAll(async () => { bcryptHash = await bcrypt.hash('mypass', 10) })

  it('верный пароль + свободный email → 200 ok', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'new@test.com', password: 'mypass' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    await app.close()
  })

  it('неверный пароль → 401', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'new@test.com', password: 'wrong' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('занятый email → 409', async () => {
    const app = await appWith(false)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'taken@test.com', password: 'mypass' })
    expect(res.status).toBe(409)
    await app.close()
  })

  it('невалидный email → 400', async () => {
    const app = await appWith(true)
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_email: 'bad', password: 'mypass' })
    expect(res.status).toBe(400)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "POST /auth/change-email"`
Expected: FAIL.

- [ ] **Step 3: Реализовать роут** (в `auth.js`)

```js
  // POST /auth/change-email — шаг 1: проверка пароля, запись pending_email, код на новый адрес.
  fastify.post('/change-email', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['new_email', 'password'],
        properties: {
          new_email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const db = fastify.db
    const { new_email, password } = request.body
    const r = await db.query('SELECT email, password_hash FROM users WHERE id = $1', [request.user.userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    if (new_email.toLowerCase() === user.email.toLowerCase()) {
      return reply.code(409).send({ error: 'email_taken' })
    }
    const taken = await db.query('SELECT id FROM users WHERE email = $1', [new_email])
    if (taken.rows.length > 0) {
      return reply.code(409).send({ error: 'email_taken' })
    }
    await db.query('UPDATE users SET pending_email = $1 WHERE id = $2', [new_email, request.user.userId])
    try {
      const code = await issueCode(db, request.user.userId, 'change_email')
      sendVerificationCode(new_email, code).catch(e =>
        fastify.log.warn(`[auth] change-email send: ${e.message}`))
    } catch (e) {
      fastify.log.warn(`[auth] change-email issueCode: ${e.message}`)
    }
    return { ok: true }
  })
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "POST /auth/change-email"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.js backend/src/__tests__/auth.test.js
git commit -m "feat(auth): POST /auth/change-email — запрос смены email (verify-first)"
```

---

## Task 4: POST /auth/confirm-email-change (шаг 2 — подтверждение кода)

**Files:**
- Modify: `backend/src/routes/auth.js`
- Test: `backend/src/__tests__/auth.test.js`

- [ ] **Step 1: Написать падающие тесты**

```js
describe('POST /auth/confirm-email-change', () => {
  it('валидный код + свободный pending → 200 + новый email', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 9 }] }
        if (sql.includes('SELECT pending_email')) return { rows: [{ pending_email: 'new@test.com' }] }
        if (sql.includes('SELECT id FROM users WHERE email')) return { rows: [] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('new@test.com')
    await app.close()
  })

  it('неверный код → 400', async () => {
    const app = await buildApp(makeMockDb({ query: async () => ({ rows: [] }) }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
    expect(res.status).toBe(400)
    await app.close()
  })

  it('pending занят между шагами → 409', async () => {
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('FROM email_codes')) return { rows: [{ id: 9 }] }
        if (sql.includes('SELECT pending_email')) return { rows: [{ pending_email: 'new@test.com' }] }
        if (sql.includes('SELECT id FROM users WHERE email')) return { rows: [{ id: 77 }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .post('/auth/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '123456' })
    expect(res.status).toBe(409)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "confirm-email-change"`
Expected: FAIL.

- [ ] **Step 3: Реализовать роут** (в `auth.js`)

```js
  // POST /auth/confirm-email-change — шаг 2: код из письма на новый адрес → переключение email.
  fastify.post('/confirm-email-change', {
    onRequest: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } }
  }, async (request, reply) => {
    const db = fastify.db
    const userId = request.user.userId
    const codeId = await findValidCode(db, userId, 'change_email', request.body.code)
    if (codeId === null) return reply.code(400).send({ error: 'invalid_or_expired_code' })

    const r = await db.query('SELECT pending_email FROM users WHERE id = $1', [userId])
    const pending = r.rows[0]?.pending_email
    if (!pending) return reply.code(400).send({ error: 'no_pending_email' })

    const taken = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [pending, userId])
    if (taken.rows.length > 0) return reply.code(409).send({ error: 'email_taken' })

    await db.query('UPDATE email_codes SET used_at = NOW() WHERE id = $1', [codeId])
    await db.query(
      'UPDATE users SET email = pending_email, pending_email = NULL, email_verified = true WHERE id = $1',
      [userId]
    )
    return { email: pending }
  })
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "confirm-email-change"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.js backend/src/__tests__/auth.test.js
git commit -m "feat(auth): POST /auth/confirm-email-change — подтверждение смены email"
```

---

## Task 5: DELETE /auth/me (удаление аккаунта) + pending_email в /me

**Files:**
- Modify: `backend/src/routes/auth.js`
- Test: `backend/src/__tests__/auth.test.js`

- [ ] **Step 1: Написать падающие тесты**

```js
describe('DELETE /auth/me', () => {
  const bcrypt = require('bcrypt')

  it('верный пароль → 200, анонимизирует payments и удаляет users', async () => {
    const hash = await bcrypt.hash('mypass', 10)
    const calls = []
    const app = await buildApp(makeMockDb({
      query: async (sql, params) => {
        calls.push(sql)
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'mypass' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(calls.some(s => s.includes('UPDATE payments SET user_id = NULL'))).toBe(true)
    expect(calls.some(s => s.includes('DELETE FROM users'))).toBe(true)
    await app.close()
  })

  it('неверный пароль → 401', async () => {
    const hash = await bcrypt.hash('mypass', 10)
    const app = await buildApp(makeMockDb({
      query: async (sql) => {
        if (sql.includes('SELECT password_hash FROM users')) return { rows: [{ password_hash: hash }] }
        return { rows: [] }
      },
    }))
    const token = makeToken(app)
    const res = await supertest(app.server)
      .delete('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong' })
    expect(res.status).toBe(401)
    await app.close()
  })

  it('без токена → 401', async () => {
    const app = await buildApp(makeMockDb())
    const res = await supertest(app.server).delete('/auth/me').send({ password: 'x' })
    expect(res.status).toBe(401)
    await app.close()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js -t "DELETE /auth/me"`
Expected: FAIL.

- [ ] **Step 3: Реализовать роут** (в `auth.js`)

```js
  // DELETE /auth/me — удаление аккаунта. Каскад через FK; payments сохраняем (анонимизация).
  fastify.delete('/me', {
    onRequest: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['password'], properties: { password: { type: 'string' } } } }
  }, async (request, reply) => {
    const db = fastify.db
    const userId = request.user.userId
    const r = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])
    const user = r.rows[0]
    if (!user || !(await bcrypt.compare(request.body.password, user.password_hash))) {
      return reply.code(401).send({ error: 'invalid_password' })
    }
    await db.query('UPDATE payments SET user_id = NULL WHERE user_id = $1', [userId])
    await db.query('DELETE FROM users WHERE id = $1', [userId])
    return { ok: true }
  })
```

- [ ] **Step 4: Добавить `pending_email` в GET /auth/me**

В `auth.js` найти `SELECT id, email, name, push_token, notification_settings, created_at, trial_started_at, subscription_until, promo_until, email_verified, auto_renew, plan, payment_method_id FROM users` и добавить `pending_email`:

```js
    const result = await fastify.db.query(
      'SELECT id, email, name, push_token, notification_settings, created_at, trial_started_at, subscription_until, promo_until, email_verified, auto_renew, plan, payment_method_id, pending_email FROM users WHERE id = $1',
      [request.user.userId]
    )
```

(`pending_email` попадёт в ответ автоматически через `...safe`.)

- [ ] **Step 5: Запустить весь сьют**

Run: `cd backend && npx vitest run src/__tests__/auth.test.js`
Expected: PASS (все, включая старые).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/auth.js backend/src/__tests__/auth.test.js
git commit -m "feat(auth): DELETE /auth/me (анонимизация payments) + pending_email в /me"
```

---

## Task 6: Web — типы + api-методы

**Files:**
- Modify: `web/src/api/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Добавить поле в UserProfile**

В `types.ts` в интерфейс `UserProfile` добавить:
```ts
  pending_email?: string | null
```

- [ ] **Step 2: Добавить методы в api** (в `client.ts`, в секцию `// --- email verification ---` или рядом с auth)

```ts
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('/auth/password', { method: 'PATCH', body: { current_password, new_password } }),
  changeEmail: (new_email: string, password: string) =>
    request<{ ok: boolean }>('/auth/change-email', { method: 'POST', body: { new_email, password } }),
  confirmEmailChange: (code: string) =>
    request<{ email: string }>('/auth/confirm-email-change', { method: 'POST', body: { code } }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>('/auth/me', { method: 'DELETE', body: { password } }),
```

- [ ] **Step 3: Проверить типы**

Run: `cd web && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/types.ts web/src/api/client.ts
git commit -m "feat(web): api-методы changePassword/changeEmail/confirmEmailChange/deleteAccount"
```

---

## Task 7: Web — ChangePasswordModal

**Files:**
- Create: `web/src/components/ChangePasswordModal.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import { useState } from 'react'
import { api, ApiError } from '../api/client'

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password'
          ? 'Неверный текущий пароль'
          : 'Не удалось сменить пароль',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="dacha-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-black">Смена пароля</h2>
        {done ? (
          <>
            <p className="font-semibold text-tertiary">Пароль изменён.</p>
            <button className="dacha-btn mt-4 w-full" onClick={onClose}>Готово</button>
          </>
        ) : (
          <>
            <input
              type="password" placeholder="Текущий пароль" value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="dacha-input mb-2 w-full" autoComplete="current-password"
            />
            <input
              type="password" placeholder="Новый пароль (мин. 6)" value={next}
              onChange={(e) => setNext(e.target.value)}
              className="dacha-input w-full" autoComplete="new-password"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || next.length < 6 || !current} onClick={submit}>
                Сменить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

> Если класса `dacha-input` нет в проекте — заменить на существующий класс полей (проверить `web/src/index.css`/использование в `LoginScreen`). Если нет общего — использовать тот же `className`, что в форме входа.

- [ ] **Step 2: Проверить типы**

Run: `cd web && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ChangePasswordModal.tsx
git commit -m "feat(web): модалка смены пароля"
```

---

## Task 8: Web — ChangeEmailModal (2 шага)

**Files:**
- Create: `web/src/components/ChangeEmailModal.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import { useState } from 'react'
import { api, ApiError } from '../api/client'

export default function ChangeEmailModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async () => {
    setBusy(true); setError(null)
    try {
      await api.changeEmail(email, password)
      setStep(2)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password' ? 'Неверный пароль'
          : err instanceof ApiError && err.code === 'email_taken' ? 'Этот email уже занят'
          : 'Не удалось отправить код',
      )
    } finally { setBusy(false) }
  }

  const confirm = async () => {
    setBusy(true); setError(null)
    try {
      await api.confirmEmailChange(code)
      onChanged()
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'email_taken' ? 'Этот email уже занят'
          : 'Неверный или просроченный код',
      )
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="dacha-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-black">Смена email</h2>
        {step === 1 ? (
          <>
            <input
              type="email" placeholder="Новый email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="dacha-input mb-2 w-full" autoComplete="email"
            />
            <input
              type="password" placeholder="Текущий пароль" value={password}
              onChange={(e) => setPassword(e.target.value)} className="dacha-input w-full" autoComplete="current-password"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || !email || !password} onClick={requestCode}>
                Отправить код
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-muted">Код отправлен на {email}. Введите его:</p>
            <input
              inputMode="numeric" placeholder="Код из письма" value={code}
              onChange={(e) => setCode(e.target.value)} className="dacha-input w-full"
            />
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
              <button className="dacha-btn flex-1" disabled={busy || !code} onClick={confirm}>Подтвердить</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Проверить типы** — `cd web && npx tsc --noEmit` → без ошибок.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ChangeEmailModal.tsx
git commit -m "feat(web): модалка смены email (2 шага, verify-first)"
```

---

## Task 9: Web — DeleteAccountModal

**Files:**
- Create: `web/src/components/DeleteAccountModal.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
import { useState } from 'react'
import { api, ApiError } from '../api/client'

export default function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      await api.deleteAccount(password)
      onDeleted()
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'invalid_password' ? 'Неверный пароль' : 'Не удалось удалить аккаунт',
      )
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="dacha-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 font-black text-red-600">Удалить аккаунт</h2>
        <p className="mb-3 text-sm font-semibold text-muted">
          Это действие необратимо. Будут удалены ваши участки, посадки, журнал и история. Восстановить данные будет нельзя.
        </p>
        <input
          type="password" placeholder="Введите пароль для подтверждения" value={password}
          onChange={(e) => setPassword(e.target.value)} className="dacha-input w-full" autoComplete="current-password"
        />
        {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button className="dacha-chip flex-1 py-3" onClick={onClose}>Отмена</button>
          <button
            className="flex-1 rounded-pill bg-red-600 py-3 font-bold text-white disabled:opacity-50"
            disabled={busy || !password} onClick={submit}
          >
            Удалить навсегда
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Проверить типы** — `cd web && npx tsc --noEmit` → без ошибок.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/DeleteAccountModal.tsx
git commit -m "feat(web): модалка удаления аккаунта"
```

---

## Task 10: Web — SettingsScreen (кнопки «Аккаунт» + секция «О приложении»)

**Files:**
- Modify: `web/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Добавить импорты и состояние**

В начало файла к импортам:
```tsx
import ChangePasswordModal from '../components/ChangePasswordModal'
import ChangeEmailModal from '../components/ChangeEmailModal'
import DeleteAccountModal from '../components/DeleteAccountModal'
```

Внутри компонента после существующих `useState`:
```tsx
  const [modal, setModal] = useState<null | 'password' | 'email' | 'delete'>(null)

  const APP_VERSION = '1.0.0' // синхронизировать с Android versionName при релизах
```

- [ ] **Step 2: Расширить секцию «Аккаунт»**

Заменить существующую секцию `<section ...>Аккаунт...</section>` на:
```tsx
      <section className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">Аккаунт</h2>
        <p className="font-semibold text-muted">{user?.email}</p>
        {user?.pending_email && (
          <p className="text-sm font-semibold text-tertiary">Ожидает подтверждения: {user.pending_email}</p>
        )}
        {user && user.email_verified === false && (
          <Link to="/verify-email" className="text-link inline-flex items-center gap-1.5">
            <MailWarning size={18} aria-hidden /> Подтвердите email →
          </Link>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <button className="dacha-chip py-3" onClick={() => setModal('password')}>Сменить пароль</button>
          <button className="dacha-chip py-3" onClick={() => setModal('email')}>Сменить email</button>
          <button className="dacha-chip py-3 font-bold text-red-600" onClick={() => setModal('delete')}>
            Удалить аккаунт
          </button>
        </div>
      </section>
```

- [ ] **Step 3: Добавить секцию «О приложении»** перед кнопкой «Выйти из аккаунта»

```tsx
      <section className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">О приложении</h2>
        <p className="font-semibold text-muted">Версия {APP_VERSION}</p>
        <a className="text-link" href="https://dacha.studio1008.com/#legal" target="_blank" rel="noopener">
          Пользовательское соглашение
        </a>
        <a className="text-link" href="https://dacha.studio1008.com/#legal" target="_blank" rel="noopener">
          Политика конфиденциальности
        </a>
        <a className="text-link" href="mailto:e-krukov@ya.ru">Поддержка: e-krukov@ya.ru</a>
      </section>
```

- [ ] **Step 4: Отрендерить модалки** перед закрывающим `</div>` корня

```tsx
      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} />}
      {modal === 'email' && (
        <ChangeEmailModal onClose={() => setModal(null)} onChanged={() => refresh()} />
      )}
      {modal === 'delete' && (
        <DeleteAccountModal
          onClose={() => setModal(null)}
          onDeleted={() => { logout(); navigate('/login', { replace: true }) }}
        />
      )}
```

- [ ] **Step 5: Проверить типы + сборку**

Run: `cd web && npx tsc --noEmit && npm run build`
Expected: без ошибок, сборка успешна.

- [ ] **Step 6: Проверить в превью** (порт 5183): открыть Настройки, проверить наличие кнопок и секции «О приложении», открытие/закрытие модалок (снапшот; скриншот может таймаутить из-за lucide).

- [ ] **Step 7: Commit**

```bash
git add web/src/screens/SettingsScreen.tsx
git commit -m "feat(web): Настройки — смена пароля/email, удаление аккаунта, О приложении"
```

---

## Task 11: Android — DachaApi + AuthRepository

**Files:**
- Modify: `android/.../data/api/DachaApi.kt`
- Modify: `android/.../data/repository/AuthRepository.kt`

- [ ] **Step 1: Добавить методы в DachaApi** (в секцию `// Auth`)

```kotlin
    // Смена пароля (залогинен)
    @PATCH("auth/password")
    suspend fun changePassword(@Body body: Map<String, String>)

    // Смена email — шаг 1: запрос кода на новый адрес
    @POST("auth/change-email")
    suspend fun changeEmail(@Body body: Map<String, String>)

    // Смена email — шаг 2: подтверждение кода
    @POST("auth/confirm-email-change")
    suspend fun confirmEmailChange(@Body body: Map<String, String>)

    // Удаление аккаунта
    @HTTP(method = "DELETE", path = "auth/me", hasBody = true)
    suspend fun deleteAccount(@Body body: Map<String, String>)
```

(`@PATCH` уже доступен через `retrofit2.http.*`.)

- [ ] **Step 2: Добавить методы в AuthRepository** (перед `fun logout()`)

```kotlin
    /** Смена пароля залогиненным пользователем (нужен текущий). */
    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Unit> {
        return try {
            api.changePassword(mapOf("current_password" to currentPassword, "new_password" to newPassword))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parsePasswordError(e))
        }
    }

    /** Смена email — шаг 1: проверка пароля + код на новый адрес. */
    suspend fun changeEmail(newEmail: String, password: String): Result<Unit> {
        return try {
            api.changeEmail(mapOf("new_email" to newEmail.trim(), "password" to password))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(
                when {
                    e.message?.contains("401") == true -> "Неверный пароль"
                    e.message?.contains("409") == true -> "Этот email уже занят"
                    e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
                    else -> "Не удалось отправить код"
                }
            )
        }
    }

    /** Смена email — шаг 2: подтверждение кода. */
    suspend fun confirmEmailChange(code: String): Result<Unit> {
        return try {
            api.confirmEmailChange(mapOf("code" to code.trim()))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(
                when {
                    e.message?.contains("409") == true -> "Этот email уже занят"
                    else -> "Неверный или просроченный код"
                }
            )
        }
    }

    /** Удаляет аккаунт (требует пароль). После успеха вызывающий делает logout. */
    suspend fun deleteAccount(password: String): Result<Unit> {
        return try {
            api.deleteAccount(mapOf("password" to password))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parsePasswordError(e))
        }
    }

    private fun parsePasswordError(e: Exception): String = when {
        e.message?.contains("401") == true -> "Неверный пароль"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> "Не удалось выполнить операцию"
    }
```

- [ ] **Step 3: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt android/app/src/main/java/ru/dachakalend/app/data/repository/AuthRepository.kt
git commit -m "feat(android): api/repo — changePassword/changeEmail/confirmEmailChange/deleteAccount"
```

---

## Task 12: Android — SettingsViewModel (состояние + функции)

**Files:**
- Modify: `android/.../ui/settings/SettingsViewModel.kt`

- [ ] **Step 1: Добавить состояние результата операций** (после существующих StateFlow)

```kotlin
    // Одноразовое сообщение результата операций аккаунта (ошибка или успех) для Snackbar/диалога.
    private val _accountMessage = MutableStateFlow<String?>(null)
    val accountMessage: StateFlow<String?> = _accountMessage.asStateFlow()
    fun clearAccountMessage() { _accountMessage.value = null }

    // pending_email (для подписи «ожидает подтверждения»)
    private val _pendingEmail = MutableStateFlow<String?>(null)
    val pendingEmail: StateFlow<String?> = _pendingEmail.asStateFlow()
```

В `loadProfile()` в ветку `is Result.Success` добавить:
```kotlin
                    _pendingEmail.value = r.data.pendingEmail
```

> Требует поля `pendingEmail` в модели `UserProfile` (Moshi `@Json(name="pending_email")`). Если отсутствует — добавить в `data/model/Models.kt`:
> ```kotlin
> @Json(name = "pending_email") val pendingEmail: String? = null,
> ```

- [ ] **Step 2: Добавить функции операций** (перед `fun logout()`)

```kotlin
    fun changePassword(current: String, next: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            when (val r = authRepository.changePassword(current, next)) {
                is Result.Success -> { _accountMessage.value = "Пароль изменён"; onSuccess() }
                is Result.Error -> _accountMessage.value = r.message
            }
        }
    }

    fun changeEmail(newEmail: String, password: String, onCodeSent: () -> Unit) {
        viewModelScope.launch {
            when (val r = authRepository.changeEmail(newEmail, password)) {
                is Result.Success -> onCodeSent()
                is Result.Error -> _accountMessage.value = r.message
            }
        }
    }

    fun confirmEmailChange(code: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            when (val r = authRepository.confirmEmailChange(code)) {
                is Result.Success -> { _accountMessage.value = "Email изменён"; loadProfile(); onSuccess() }
                is Result.Error -> _accountMessage.value = r.message
            }
        }
    }

    fun deleteAccount(password: String, onDeleted: () -> Unit) {
        viewModelScope.launch {
            when (val r = authRepository.deleteAccount(password)) {
                is Result.Success -> { tokenStorage.logout(); _loggedOut.value = true; onDeleted() }
                is Result.Error -> _accountMessage.value = r.message
            }
        }
    }
```

- [ ] **Step 3: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/settings/SettingsViewModel.kt android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt
git commit -m "feat(android): SettingsViewModel — операции аккаунта + pendingEmail"
```

---

## Task 13: Android — SettingsScreen (секции «АККАУНТ» и «О ПРИЛОЖЕНИИ» + диалоги)

**Files:**
- Modify: `android/.../ui/settings/SettingsScreen.kt`

- [ ] **Step 1: Добавить состояние диалогов** в `SettingsScreen` (рядом с `showLogoutDialog`)

```kotlin
    var showPasswordDialog by remember { mutableStateOf(false) }
    var showEmailDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    val accountMessage by viewModel.accountMessage.collectAsState()
    val pendingEmail by viewModel.pendingEmail.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(accountMessage) {
        accountMessage?.let {
            android.widget.Toast.makeText(context, it, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearAccountMessage()
        }
    }
```

- [ ] **Step 2: Добавить секцию «АККАУНТ»** в `Column` после блока баннера email (перед блоком подписки)

```kotlin
            Text(
                text = "АККАУНТ",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            email?.let {
                Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp))
            }
            pendingEmail?.let {
                Text("Ожидает подтверждения: $it", fontFamily = NunitoFamily, fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 4.dp))
            }
            SettingsActionRow("Сменить пароль") { showPasswordDialog = true }
            HorizontalDivider()
            SettingsActionRow("Сменить email") { showEmailDialog = true }
            HorizontalDivider()
            SettingsActionRow("Удалить аккаунт", danger = true) { showDeleteDialog = true }
            Spacer(Modifier.height(16.dp))
```

- [ ] **Step 3: Добавить секцию «О ПРИЛОЖЕНИИ»** перед кнопкой «Выйти из аккаунта»

```kotlin
            Text(
                text = "О ПРИЛОЖЕНИИ",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            Text(
                "Версия ${BuildConfig.VERSION_NAME}",
                fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp)
            )
            val openUrl = { url: String ->
                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            }
            SettingsActionRow("Пользовательское соглашение") { openUrl("https://dacha.studio1008.com/#legal") }
            HorizontalDivider()
            SettingsActionRow("Политика конфиденциальности") { openUrl("https://dacha.studio1008.com/#legal") }
            HorizontalDivider()
            SettingsActionRow("Поддержка: e-krukov@ya.ru") { openUrl("mailto:e-krukov@ya.ru") }
            Spacer(Modifier.height(24.dp))
```

- [ ] **Step 4: Добавить хелпер-строку `SettingsActionRow`** рядом с `NotificationToggle`

```kotlin
@Composable
private fun SettingsActionRow(title: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
            color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground
        )
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
```

- [ ] **Step 5: Добавить диалоги** в конец тела `SettingsScreen` (после `Scaffold { ... }`, внутри `@Composable` функции)

```kotlin
    if (showPasswordDialog) {
        var current by remember { mutableStateOf("") }
        var next by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showPasswordDialog = false },
            title = { Text("Смена пароля", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    OutlinedTextField(current, { current = it }, label = { Text("Текущий пароль") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(next, { next = it }, label = { Text("Новый пароль (мин. 6)") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                }
            },
            confirmButton = {
                TextButton(enabled = current.isNotBlank() && next.length >= 6,
                    onClick = { viewModel.changePassword(current, next) { showPasswordDialog = false } }) {
                    Text("Сменить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showPasswordDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }

    if (showEmailDialog) {
        var stepCode by remember { mutableStateOf(false) }
        var newEmail by remember { mutableStateOf("") }
        var pass by remember { mutableStateOf("") }
        var code by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showEmailDialog = false },
            title = { Text("Смена email", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                if (!stepCode) Column {
                    OutlinedTextField(newEmail, { newEmail = it }, label = { Text("Новый email") }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(pass, { pass = it }, label = { Text("Текущий пароль") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                } else Column {
                    Text("Код отправлен на $newEmail", fontFamily = NunitoFamily, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(code, { code = it }, label = { Text("Код из письма") }, singleLine = true)
                }
            },
            confirmButton = {
                if (!stepCode) TextButton(enabled = newEmail.isNotBlank() && pass.isNotBlank(),
                    onClick = { viewModel.changeEmail(newEmail, pass) { stepCode = true } }) {
                    Text("Отправить код", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                } else TextButton(enabled = code.isNotBlank(),
                    onClick = { viewModel.confirmEmailChange(code) { showEmailDialog = false } }) {
                    Text("Подтвердить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showEmailDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }

    if (showDeleteDialog) {
        var pass by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Удалить аккаунт?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.error) },
            text = {
                Column {
                    Text("Это действие необратимо. Будут удалены участки, посадки, журнал и история.",
                        fontFamily = NunitoFamily)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(pass, { pass = it }, label = { Text("Пароль для подтверждения") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                }
            },
            confirmButton = {
                TextButton(enabled = pass.isNotBlank(),
                    onClick = { viewModel.deleteAccount(pass) { showDeleteDialog = false } }) {
                    Text("Удалить навсегда", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }
```

> `OutlinedTextField` требует импорта `androidx.compose.material3.OutlinedTextField` (входит в `material3.*`, уже импортирован через `material3.*`).

- [ ] **Step 6: Скомпилировать**

Run: `cd android && ./gradlew :app:compileGplayDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/settings/SettingsScreen.kt
git commit -m "feat(android): Настройки — секции Аккаунт/О приложении + диалоги (пароль/email/удаление)"
```

---

## Task 14: Деплой и проверка в проде

**Files:** —

- [ ] **Step 1: Запустить полный backend-сьют**

Run: `cd backend && npx vitest run`
Expected: все тесты PASS (старые + ~14 новых).

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Обновить VPS + миграция 036 + рестарт** (PowerShell, `ssh hetzner`)

```
ssh hetzner "cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main"
ssh hetzner "sudo -u postgres psql -d dacha_db -f /var/www/dacha-api/backend/src/db/migrations/036_account_management.sql"
ssh hetzner "pm2 restart dacha-api"
```
Expected: `ALTER TABLE` ×3 без ошибок; pm2 online. (FK `payments_user_id_fkey` — стандартное авто-имя; если иное, `\d payments` покажет реальное — поправить DROP CONSTRAINT.)

- [ ] **Step 4: Пересобрать и выложить веб** (PowerShell)

```
ssh hetzner "cd /var/www/dacha-api/web && npm ci --silent && npm run build && rm -rf /var/www/dacha-web/* && cp -r dist/* /var/www/dacha-web/"
```

- [ ] **Step 5: Smoke на проде** (на тестовом аккаунте — НЕ удалять основной)

```
# смена пароля
curl -s -X PATCH https://dacha.studio1008.com/auth/password -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"current_password":"...","new_password":"..."}'
# ожидаем {"ok":true}; повторный логин старым паролем → 401, новым → 200
```
Expected: смена пароля и обратно работает; `/auth/me` отдаёт `pending_email` (null). Удаление — на одноразовом аккаунте: `DELETE /auth/me` → 200, повторный `/auth/me` старым токеном → не находит, строка payments (если была) осталась с `user_id=NULL`.

- [ ] **Step 6: Обновить роадмап**

В `docs/ux-roadmap.md` пометить подпункты П4 A+B+E выполненными; C/D оставить открытыми.

```bash
git add docs/ux-roadmap.md
git commit -m "docs: П4 A+B+E (аккаунт/безопасность) сделано; C/D открыты"
git push origin main
```

- [ ] **Step 7: Обновить память** `project_dacha.md` / `project_dacha_web.md` — новые эндпоинты, миграция 036, что задеплоено; Android — в main, в стор публикует пользователь.

---

## Self-Review (заполнено автором плана)

**Spec coverage:** A (удаление) — Task 1,5,9,13; B пароль — Task 2,7,13; B email — Task 3,4,8,13; E «О приложении» — Task 10,13; backend pending_email — Task 5; деплой — Task 14. Все требования спека покрыты.

**Placeholder scan:** код приведён полностью; два явных «проверь имя класса/поля» (web `dacha-input`, Android `UserProfile.pendingEmail`) помечены как условные шаги с готовой заменой — не плейсхолдеры логики.

**Type consistency:** имена методов едины (`changePassword/changeEmail/confirmEmailChange/deleteAccount`) в backend-роутах, web `api`, Android `DachaApi`/`AuthRepository`/`SettingsViewModel`. Коды ошибок (`invalid_password`, `email_taken`, `invalid_or_expired_code`) едины backend↔клиенты.

**Открытые мелочи к проверке при исполнении:** наличие класса полей ввода в web (Task 7 step note); поле `pendingEmail` в Android `UserProfile` (Task 12 step 1 note); реальное имя FK `payments_user_id_fkey` (Task 14 step 3).
