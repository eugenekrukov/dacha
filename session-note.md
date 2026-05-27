# Протокол рабочей сессии разработчика

**Дата сессии**: 2026-05-27  
**Текущий контекст**: Сессия 1 — Инициализация проекта, настройка окружения

## 1. Что было сделано за сессию
- Определён технический стек: Node.js 20 + Fastify + PostgreSQL
- Создана полная структура backend-проекта в `backend/`
- Реализованы все роуты MVP: auth, gardens, crops, plantings, actions, weather, recommendations, reminders, harvests
- Написана логика трёхслойных рекомендаций (Культура + Погода + Стадия)
- Созданы SQL-миграции для всех 9 сущностей + seed базового справочника культур (21 позиция)
- Настроены конфиги деплоя: `ecosystem.config.js` (pm2), `nginx.conf.example`, `scripts/deploy.sh`

## 2. Технические решения и нюансы
- Порт **3002** — чтобы не конфликтовать с `landing-admin` (порт 3001) на том же VPS
- PostgreSQL нужно **установить на VPS** (`apt install postgresql`)
- `.env.example` содержит все необходимые переменные — скопировать в `.env` на сервере
- Справочник культур (`crops`) — публичный (без авторизации), посадки (`plantings`) — приватные
- Погода кэшируется в `weather_snapshots`, кэш считается свежим 3 часа
- Рекомендации генерируются on-demand при GET-запросе и сохраняются в БД

## 3. Архитектурные решения сессии
- Сущность `Recommendation`: генерация через `/recommendations?garden_id=` на основе трёх слоёв
- Сущность `ActionLog`: тип действия — `watered | fertilized | treated | transplanted | other`
- Сущность `Planting`: стадия — `sowing | sprouted | growing | flowering | harvesting | done`

## 4. Итог сессии — деплой завершён ✅
- Репозиторий: https://github.com/eugenekrukov/dacha.git (ветка main)
- VPS: 78.47.58.211, API доступен по `http://78.47.58.211/dacha/`
- pm2 процесс: `dacha-api`, порт 3002
- nginx: location `/dacha/` проксирует на 127.0.0.1:3002 в `/etc/nginx/sites-available/default`
- Health check: `http://78.47.58.211/dacha/health` → 200 OK

## 5. План на следующую сессию (Next Steps)
- [x] Протестировать авторизацию end-to-end: `POST /dacha/auth/register` → `POST /dacha/auth/login` ✅
- [ ] Спринт 2: добавить агрегирующий эндпоинт `GET /today?garden_id=` (топ задач дня)
- [ ] Настроить деплой-скрипт `scripts/deploy.sh` для последующих обновлений
- [ ] Добавить `fastify-plugin` как зависимость в package.json (нужен для `src/plugins/db.js`)

---

## Сессия 2 — 2026-05-27: Закрытие Спринта 1

### Что сделано
- Протестирована авторизация end-to-end:
  - `GET /dacha/health` → 200 O