# П4-срез «Аккаунт и безопасность» — дизайн

**Дата:** 2026-06-15
**Источник:** `docs/ux-roadmap.md` → этап 2, П4 «Переработка Настроек».
**Объём этой итерации:** подфичи **A + B + E** (удаление аккаунта, смена пароля/email,
«О приложении»/оферта/поддержка). Подфичи **C** (смена города/региона) и **D** (управление
участками + переключатель активного сада) — отдельный цикл spec → план позже (D затрагивает
концепцию «активного сада» по всему приложению и не помещается в этот спек).

Платформы: backend (Fastify + PostgreSQL), web (React+Vite+TS), Android (Kotlin+Compose+Hilt).
Принцип: зеркалить веб и Android, единый backend. Android — по `android/CONVENTIONS.md`.

---

## Цели и критерии готовности

1. **Удаление аккаунта** — обязательно для Google Play / RuStore Data Safety. Пользователь может
   удалить аккаунт и все персональные данные из приложения.
2. **Смена пароля** — залогиненный пользователь меняет пароль, зная текущий.
3. **Смена email** — verify-first: новый адрес подтверждается кодом до переключения.
4. **«О приложении»** — версия, ссылки на оферту/политику, контакт поддержки (доверие + требование
   сторов).

Не входит: смена города/региона (C), управление участками/переключатель (D), уведомления на web.

---

## Решения (зафиксированы в брейнсторминге)

- **Удаление = hard delete с сохранением платежей.** Каскадно удаляем `users` (и через FK всё
  остальное), но строки `payments` **анонимизируем** (`user_id = NULL`) — чеки НПД самозанятого
  нужно хранить для ФНС/бухгалтерии.
- **Смена email = verify-first.** Новый адрес хранится в `users.pending_email`, код уходит на
  **новый** адрес, переключение `email` происходит только после подтверждения кода.
- **Подтверждение опасных действий = текущий пароль.** Удаление, смена email и смена пароля требуют
  ввода текущего пароля в модалке/диалоге. У удаления — крупное предупреждение + кнопка
  «Удалить навсегда». Без ввода слова «УДАЛИТЬ» (аудитория 40+, пароль = достаточное трение).

---

## Backend

### Аудит внешних ключей (по факту кода)

Каскад при `DELETE FROM users WHERE id = $1` уже работает для всего, кроме `payments`:

| Таблица | FK | Поведение | Действие |
|---|---|---|---|
| gardens, reminders, push_tokens, email_codes | `user_id … ON DELETE CASCADE` | удалятся | — |
| plantings, actions, harvests, care_alert_log | каскад через gardens/plantings | удалятся | — |
| promo_codes.redeemed_by | `ON DELETE SET NULL` | анонимизируется | — |
| **payments.user_id** | `NOT NULL … ON DELETE CASCADE` (024) | **удалится — нежелательно** | **изменить FK** |

### Миграция `036_account_management.sql`

Идемпотентна. Применять на проде **точечно как app-юзер** (`payments` принадлежит `dacha_user`,
готча владельца 009 не мешает; чистые ALTER/ADD COLUMN).

```sql
-- 1) Буфер для verify-first смены email
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);

-- 2) payments: анонимизация вместо каскадного удаления при удалении аккаунта
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

`email_codes` НЕ меняем — переиспользуем с новым `purpose='change_email'` (схема `purpose` —
свободный VARCHAR, без CHECK).

### Эндпоинты (`routes/auth.js`, все `onRequest: [fastify.authenticate]`)

- **`PATCH /auth/password`** — `{ current_password, new_password(minLength 6) }`.
  Сверка `bcrypt.compare(current_password, hash)`; 401 `invalid_password` при несовпадении.
  Успех → `UPDATE users SET password_hash=$1`. Rate-limit 10/мин.
- **`POST /auth/change-email`** — `{ new_email(format email), password }`.
  Сверка пароля (401). 409 `email_taken`, если `new_email` уже в `users.email` (любого юзера) или
  совпадает с текущим. Иначе: `UPDATE users SET pending_email=$new`; выпустить код
  `purpose='change_email'`; отправить на **новый** адрес (`sendVerificationCode`, fire-and-forget).
  Возврат `{ ok: true }`. Rate-limit 5/10мин.
- **`POST /auth/confirm-email-change`** — `{ code }`.
  `findValidCode(purpose='change_email')`; 400 `invalid_or_expired_code`. Повторная проверка, что
  `pending_email` всё ещё свободен (409 `email_taken` — мог занять кто-то между шагами). Успех:
  `UPDATE users SET email=pending_email, pending_email=NULL, email_verified=true`; пометить код
  used. Возврат `{ email }`. Rate-limit 10/мин.
- **`DELETE /auth/me`** — `{ password }`.
  Сверка пароля (401). Транзакция: `UPDATE payments SET user_id=NULL WHERE user_id=$1` →
  `DELETE FROM users WHERE id=$1` (каскад). Возврат `{ ok: true }`. Клиент после 200 делает logout.

`/auth/me` дополнить полем `pending_email` (чтобы UI показывал «ожидает подтверждения: …»).

### Тесты (`backend/.../auth.test.js`, vitest)

- `PATCH /password`: неверный текущий → 401; успех → новый пароль логинится, старый нет.
- `POST /change-email`: неверный пароль → 401; занятый email → 409; успех ставит `pending_email`,
  не трогает `email`.
- `POST /confirm-email-change`: неверный код → 400; успех меняет `email`, чистит `pending_email`,
  ставит `email_verified=true`.
- `DELETE /auth/me`: неверный пароль → 401; успех удаляет users + каскад (gardens/plantings/actions),
  но строка `payments` остаётся с `user_id=NULL`; повторный `/auth/me` по старому токену → не находит.

---

## Web (React + Vite + TS)

`src/screens/SettingsScreen.tsx` — добавить секции (стиль `dacha-card`), порядок:
Аккаунт · Внешний вид · Подписка · О приложении · Выход.

- **Аккаунт** (расширить существующую секцию): email + verify-ссылка (есть); строка
  «ожидает подтверждения: pending_email» если задан; кнопки **«Сменить пароль»**,
  **«Сменить email»**, **«Удалить аккаунт»** (красная).
- **О приложении** (новая): версия (константа из `package.json`/Vite env); ссылки
  «Пользовательское соглашение» и «Политика конфиденциальности» (на лендинг
  `https://dacha.studio1008.com/…`); «Поддержка» — `mailto:e-krukov@ya.ru`.

Новые компоненты (`src/components/`):
- `ChangePasswordModal` — поля текущий/новый пароль; вызывает `api.changePassword`.
- `ChangeEmailModal` — 2 шага: (1) новый email + пароль → `api.changeEmail`; (2) ввод кода →
  `api.confirmEmailChange`; по успеху `refresh()`.
- `DeleteAccountModal` — предупреждение + поле пароля + кнопка «Удалить навсегда»; по успеху
  `logout()` + `navigate('/login')`.

`src/api/client.ts` — методы `changePassword`, `changeEmail`, `confirmEmailChange`, `deleteAccount`.

Проверка: `tsc --noEmit` + превью (порт 5183).

## Android (Kotlin + Compose + Hilt)

`ui/settings/SettingsScreen.kt` — добавить секции:
- **«АККАУНТ»**: строки «Сменить пароль», «Сменить email», «Удалить аккаунт» (красная).
- **«О ПРИЛОЖЕНИИ»**: версия (`BuildConfig.VERSION_NAME`/`VERSION_CODE`), «Оферта», «Политика»,
  «Поддержка» (Intent на URL/mailto).

Диалоги (AlertDialog или отдельные Composable) под три действия, зеркало веба (смена email — 2 шага).
`SettingsViewModel` + `data/DachaApi` + `data/AuthRepository` — методы
`changePassword/changeEmail/confirmEmailChange/deleteAccount`. Модели запросов/ответов в `Models.kt`.
После удаления — очистка `TokenStorage` + переход на логин (как при logout).

Проверка: `:app:compileGplayDebugKotlin` BUILD SUCCESSFUL (юнит-тесты в этом окружении не
запускаются — известная инфра-проблема; логику покрывает backend-сьют).

---

## Архитектура: границы единиц

- **Backend-эндпоинты** — независимые роуты в существующем `auth.js`, каждый делает одно действие,
  общается через JSON, тестируется изолированно сьютом.
- **Модалки/диалоги** (web + Android) — самодостаточные, на вход берут callbacks, наружу отдают
  результат через api-слой; не знают о внутренностях друг друга.
- **api-слой** (web `client.ts`, Android `DachaApi`/`AuthRepository`) — единственная точка контакта
  с backend; экраны не дергают сеть напрямую.

## Деплой

1. `git push` → на VPS `fetch + reset --hard origin/main`.
2. Миграция 036 — точечно как app-юзер (Node `dotenv+pg` скрипт или `psql` под нужной ролью; НЕ
   `npm run migrate` — падает на 009). `payments` принадлежит `dacha_user` → ALTER проходит.
3. `pm2 restart dacha-api` (новые роуты — backend-код менялся).
4. Web — `npm ci && npm run build` + копия в `/var/www/dacha-web`.
5. Android — пользователь публикует AAB/APK (вне этого деплоя).
6. Проверка: smoke каждого эндпоинта на проде на тестовом аккаунте; самоудаление — на одноразовом.

## Риски / открытые мелочи

- **Каскад payments на проде**: убедиться, что FK реально называется `payments_user_id_fkey`
  (стандартное авто-имя; `DROP CONSTRAINT IF EXISTS` безопасен, если имя иное — поправить).
- **Версия web**: нет единого источника — взять из `package.json` через Vite `define` или хардкод-
  константу; согласовать с Android `versionName` (сейчас 1.0.0).
- **Логин после смены email**: токен остаётся валидным (JWT по `userId`), но `email` в payload
  устаревает — некритично (сервер читает `userId`); при желании можно перелогинить.
