---
tags: [dacha, backend]
---

> обновлено: 2026-07-01, commit `945b12e`


# Backend

Путь в репо: `backend/`. Точка входа: `backend/src/app.js`.

## Структура
```
backend/src/
├── app.js
├── plugins/db.js          — pg Pool
├── routes/                — auth, billing, promo, guide, gardens, beds, crops,
│                             plantings, actions, photos, feed, recommendations,
│                             today, moon-calendar, weather, harvests, reminders,
│                             push-tokens, analytics, geocode, unsubscribe
├── services/
│   ├── weatherService.js  — Open-Meteo
│   ├── pushService.js     — RuStore Push API
│   ├── emailService.js    — Brevo HTTP API (SMTP режется Hetzner)
│   └── yookassaService.js — ЮKassa
├── jobs/
│   ├── weatherJob.js          — cron каждые 3 ч
│   ├── careRemindersJob.js    — cron ежедневно 09:00
│   ├── renewalJob.js          — cron 10:00
│   ├── nalogJob.js            — авторегистрация чеков НПД
│   └── vkQueueJob.js          — автопостер ВК
├── utils/
│   ├── todayLogic.js      — buildTasks / formatTasks (чистые функции)
│   ├── access.js          — hasAccess / requireAccess (биллинг-гейт)
│   └── regionCoords.js
└── db/migrations/         — SQL миграции 001–055
```

## Тесты
**vitest**, не jest. Запуск: `npm test`. 398/398 на момент последнего обновления.
См. `TESTING.md` в репо.

## Недавно добавлено
- `GET /moon-calendar?year=&month=` (2026-07-01) — фазы Луны на месяц + сводка на сегодня; переиспользует существующую классификацию ново-/полнолуния из `data/tips.js` `getMoonPhase` (без новой crop-специфичной таблицы «благоприятных дней» — единого источника для всех культур нет).
- `garden_beds` (грядки + севооборот, миграции 052/053) — таблица создавалась суперюзером, GRANT для `dacha_user` пришлось докатывать отдельной миграцией 055 (урок: явный GRANT нужен всегда, если DDL идёт не от `dacha_user`).

## Деплой
VPS — read-only зеркало `origin/main`, деплой через `reset --hard`, не `git pull`.
```bash
cd /var/www/dacha-api && git fetch origin && git reset --hard origin/main
cd backend && npm install   # если менялись зависимости
pm2 restart dacha-api
```
Полная цепочка миграций НЕ идемпотентна (падает на 009). Новые — точечно. Подробнее [[07 Деплой и инфраструктура]].

## Связано
[[01 Архитектура]] · [[05 База данных]] · [[06 Монетизация]]
