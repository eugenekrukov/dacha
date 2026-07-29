---
tags: [dacha, backend]
---

> обновлено: 2026-07-29
> проверено: 2026-07-29


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
│   ├── yookassaService.js — ЮKassa
│   └── telegramService.js — Bot API (@calendacha_bot → канал @calendacha)
├── jobs/
│   ├── weatherJob.js          — cron каждые 3 ч
│   ├── careRemindersJob.js    — cron ежедневно 09:00
│   ├── renewalJob.js          — cron 10:00
│   ├── nalogJob.js            — авторегистрация чеков НПД
│   ├── vkQueueJob.js          — автопостер ВК
│   └── telegramQueueJob.js    — автопостер Telegram (та же очередь, статус независим)
├── utils/
│   ├── todayLogic.js      — buildTasks / formatTasks (чистые функции)
│   ├── access.js          — hasAccess / requireAccess (биллинг-гейт)
│   └── regionCoords.js
└── db/migrations/         — SQL миграции 001–059
```

## Тесты
**vitest**, не jest. Запуск: `npm test`. 437/437 на момент последнего обновления.
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

## Добавлено позже (2026-07-18 … 07-29)
- **Автопостер Telegram**: миграция 058 добавила колонки `telegram_*` в `vk_post_queue` —
  статус публикации независим от ВК, чтобы сбой одного канала не блокировал другой.
  Включается только при `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID`.
- **Блог `/blog/`**: `scripts/generate-blog.js` рендерит статьи контент-плана в статические
  страницы лендинга. Источник — те же md-файлы, что и очередь соцсетей, НЕ база. Общие SEO-хелперы
  вынесены в `scripts/lib/seoPage.js`; оба генератора (spravochnik/blog) мержат `sitemap.xml`
  каждый по своей зоне URL.
- **Советы дня**: в `data/tips.js` появился маркер `potOnly()` — совет про подоконник не выдаётся
  прямому посеву; на стадии `growing` таких советов нет вовсе (растение уже в грунте при любом
  способе посадки). Индекс совета учитывает `plantingId`, иначе все посадки в один день получали
  один текст.
- **История грядки** (`GET /gardens/:id/beds`) отдаёт `planting_id` — клиент исключает текущую
  посадку, иначе подсказка севооборота срабатывала на неё саму.
