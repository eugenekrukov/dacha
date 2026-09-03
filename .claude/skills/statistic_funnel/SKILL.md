---
name: statistic_funnel
description: Use when the user runs /statistic_funnel or asks for the acquisition/activation funnel of Dacha — registrations → email confirmed → garden created → first planting → trial started → paid, computed over REAL users only (test accounts excluded).
---

# /statistic_funnel — воронка Dacha (только реальные пользователи)

Считает воронку в **проде** (Postgres `dacha_db` на VPS `hetzner`) из существующих таблиц,
**исключая тест-аккаунты** (`users.is_test = false`):
регистрации → подтв. email → создали участок → 1-я посадка → старт триала → оплатили.

> ⚠️ Требует миграцию `041_analytics_is_test.sql` (колонка `users.is_test`). Если запрос падает на
> отсутствии колонки — миграция ещё не задеплоена на VPS (`npm run migrate`).
>
> ⚠️ Требует миграцию `089_funnel_events.sql` (колонки `users.limit_hit_at`,
> `users.paywall_opened_at`).

## Как выполнить

SSH к VPS — **только из PowerShell-инструмента**. SQL через **stdin в base64**. Выполни ровно это:

```powershell
$sql = @'
WITH ru AS (
  SELECT id, email_verified, limit_hit_at, paywall_opened_at FROM users WHERE is_test = false
)
SELECT
  (SELECT count(*) FROM ru)                                              AS "Регистрации",
  (SELECT count(*) FROM ru WHERE email_verified)                        AS "Email подтв.",
  (SELECT count(DISTINCT g.user_id)
     FROM gardens g JOIN ru ON ru.id = g.user_id)                       AS "Участок создан",
  (SELECT count(DISTINCT g.user_id)
     FROM plantings p JOIN gardens g ON g.id = p.garden_id
     JOIN ru ON ru.id = g.user_id)                                      AS "1-я посадка",
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

Покажи воронку с шагами и конверсией между соседними шагами (в %).

## Определения шагов
- **Регистрации** — `users` (не тест).
- **Email подтв.** — `email_verified = true`.
- **Участок создан** — есть запись в `gardens`.
- **1-я посадка** — есть запись в `plantings` (через `gardens.user_id`).
- **Упёрся в лимит** — `limit_hit_at IS NOT NULL` (получил 402 по free-лимиту посадок хотя бы раз).
- **Paywall открыт** — `paywall_opened_at IS NOT NULL` (открыл экран пейволла хотя бы раз).
- **Оплата начата** — есть строка в `payments` со статусом `pending` или `succeeded`
  (`POST /billing/create-payment` создаёт `pending` ещё до перехода на оплату; `pending`,
  не ставший `succeeded`, — брошенная оплата).
- **Оплатили** — есть `payments.status = 'succeeded'`.

Связано: тест-аккаунты ведутся флагом `users.is_test` (миграция 041); пометить нового тестера —
`UPDATE users SET is_test = true WHERE email = '...'`. Сырые списки — `/statistic`, `/statistic_user`.
