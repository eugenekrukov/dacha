---
name: statistic_funnel
description: Use when the user runs /statistic_funnel or asks for the acquisition/activation funnel of Dacha — start (guest or registration) → garden created → first planting → account (registered) → email confirmed → hit free limit → paywall opened → payment started → paid, computed over REAL users only (test accounts excluded).
---

# /statistic_funnel — воронка Dacha (только реальные пользователи)

Считает воронку в **проде** (Postgres `dacha_db` на VPS `hetzner`) из существующих таблиц,
**исключая тест-аккаунты** (`users.is_test = false`).

С гостевым режимом (2026-09, миграция 092) порядок шагов поменялся: человек сначала создаёт участок
и посадки, а регистрируется позже (или никогда). Поэтому воронка начинается со **старта** (гость или
сразу регистрация), а «Аккаунт» стоит после первой посадки:

старт → участок → 1-я посадка → аккаунт → email подтв. → упёрся в лимит → paywall открыт → оплата начата → оплатили.

> ⚠️ Требует миграции `041_analytics_is_test.sql` (`users.is_test`), `089_funnel_events.sql`
> (`users.limit_hit_at`, `users.paywall_opened_at`) и `092_guest_users.sql` (`users.is_guest`).
> Без 092 шаг «Аккаунт» считай равным «Старту» (гостей ещё нет) — убери `WHERE NOT is_guest`.

## Как выполнить

SSH к VPS — **только из PowerShell-инструмента**. SQL через **stdin в base64**. Выполни ровно это:

```powershell
$sql = @'
WITH ru AS (
  SELECT id, is_guest, guest_device_id, email_verified, limit_hit_at, paywall_opened_at
  FROM users WHERE is_test = false
)
SELECT
  (SELECT count(*) FROM ru)                                              AS "Старт",
  (SELECT count(*) FROM ru WHERE guest_device_id IS NOT NULL)            AS "  из них гостем",
  (SELECT count(DISTINCT g.user_id)
     FROM gardens g JOIN ru ON ru.id = g.user_id)                       AS "Участок создан",
  (SELECT count(DISTINCT g.user_id)
     FROM plantings p JOIN gardens g ON g.id = p.garden_id
     JOIN ru ON ru.id = g.user_id)                                      AS "1-я посадка",
  (SELECT count(*) FROM ru WHERE NOT is_guest)                          AS "Аккаунт",
  (SELECT count(*) FROM ru WHERE NOT is_guest AND email_verified)       AS "Email подтв.",
  (SELECT count(*) FROM ru WHERE limit_hit_at IS NOT NULL)              AS "Упёрся в лимит",
  (SELECT count(*) FROM ru WHERE paywall_opened_at IS NOT NULL)         AS "Paywall открыт",
  (SELECT count(DISTINCT pay.user_id)
     FROM payments pay JOIN ru ON ru.id = pay.user_id
     WHERE pay.status IN ('pending', 'succeeded'))                      AS "Оплата начата",
  (SELECT count(DISTINCT pay.user_id)
     FROM payments pay JOIN ru ON ru.id = pay.user_id
     WHERE pay.status = 'succeeded')                                    AS "Оплатили";
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($sql -replace "`r","")))
ssh hetzner "echo $b64 | base64 -d | sudo -u postgres psql -d dacha_db"
```

Покажи воронку с шагами и конверсией между соседними шагами (в %). «из них гостем» — не шаг, а
расшифровка старта. Для сравнения с периодом до гостевого режима (до деплоя 092) помни: раньше
«Старт» = «Аккаунт», и регистрация стояла первой — конверсии старт→участок до и после несравнимы
напрямую.

## Определения шагов
- **Старт** — все `users` (не тест): и гости, и зарегистрированные.
- **из них гостем** — начали без регистрации (`guest_device_id` заполнен), независимо от того,
  зарегистрировались ли потом.
- **Участок создан** — есть запись в `gardens`.
- **1-я посадка** — есть запись в `plantings` (через `gardens.user_id`).
- **Аккаунт** — есть email и пароль (`is_guest = false`): сразу зарегистрировался или гость сделал claim.
- **Email подтв.** — `email_verified = true`.
- **Упёрся в лимит** — `limit_hit_at IS NOT NULL` (получил 402 по free-лимиту посадок хотя бы раз;
  гости тоже упираются — лимит у них тот же).
- **Paywall открыт** — `paywall_opened_at IS NOT NULL` (открыл экран пейволла хотя бы раз).
- **Оплата начата** — есть строка в `payments` со статусом `pending` или `succeeded`
  (`POST /billing/create-payment` создаёт `pending` ещё до перехода на оплату; `pending`,
  не ставший `succeeded`, — брошенная оплата). Гостю оплата закрыта (403 `account_required`).
- **Оплатили** — есть `payments.status = 'succeeded'`.

Связано: тест-аккаунты ведутся флагом `users.is_test` (миграция 041); пометить нового тестера —
`UPDATE users SET is_test = true WHERE email = '...'`. Сырые списки — `/statistic`, `/statistic_user`.
