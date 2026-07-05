---
tags: [dacha, web]
---

> обновлено: 2026-07-01, commit `945b12e`


# Web

Путь в репо: `web/`. React 18 + Vite + TypeScript + Tailwind, тот же backend/БД.

Прод: https://dacha.studio1008.com/app/ — статика `/var/www/dacha-web`, nginx `location /app/`.

## Деплой
```bash
cd /var/www/dacha-api/web && npm ci && npm run build
rm -rf /var/www/dacha-web/* && cp -r dist/* /var/www/dacha-web/
```

## Состояние
- Паритет с Android по разделу «Профиль/Мой участок» — задеплоено 2026-06-23.
- Лента «Мой участок» (запись-центричная: action/photo/milestone) — на проде.
- Грядки + севооборот («план участка») — UI на проде (2026-07-01): поле «Место», инлайн CRUD грядок, подсказка севооборота.
- Экран «Календарь» показывает фазу Луны прямо в сетке дней + карточку совета/«Не сажать» для выбранного дня (2026-07-01, `screens/CalendarScreen.tsx` + `ui/MoonIcon.tsx`, данные — `GET /moon-calendar`). Изначально был отдельный экран — слит в существующий календарь по фидбэку владельца.
- Осталось: P4 онбординг-выбор культур, P5 snooze/reverse-geocode/Web Push.

Локальное превью: порт 5183, иконки — lucide.

## Связано
[[01 Архитектура]] · [[02 Backend]] · [[08 Статус и бэклог]]
