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

## 4. План на следующую сессию (Next Steps)
- [ ] Подключить репозиторий GitHub (git init + remote add + первый push)
- [ ] Установить PostgreSQL на VPS и применить миграции
- [ ] Задеплоить backend через `scripts/deploy.sh`
- [ ] Добавить `fastify-plugin` зависимость (нужна для `src/plugins/db.js`)
- [ ] Начать Спринт 2: экран "Сегодня" — логика агрегации задач дня на бэкенде

## 5. Команды для следующей сессии
```bash
# Локально — инициализация Git
git init
git add .
git commit -m "feat: initial backend structure — Fastify API + PostgreSQL migrations"
git remote add origin https://github.com/YOUR_USERNAME/dacha-calendar.git
git push -u origin main

# На VPS — установка PostgreSQL
apt update && apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER dacha_user WITH PASSWORD 'YOUR_PASS';"
sudo -u postgres psql -c "CREATE DATABASE dacha_db OWNER dacha_user;"

# На VPS — первый деплой
git clone https://github.com/YOUR_USERNAME/dacha-calendar.git /var/www/dacha-api
cd /var/www/dacha-api/backend
cp .env.example .env  # заполнить реальными значениями
npm install
npm run migrate
pm2 start ecosystem.config.js --env production
```
