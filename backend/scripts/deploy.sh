#!/bin/bash
# Деплой на VPS: запусти из папки /var/www/dacha-api на сервере
# Использование: bash scripts/deploy.sh

set -e

echo "🌿 Deploying Dacha Calendar API..."

# Получить последние изменения
git pull origin main

# Установить/обновить зависимости
npm install --production

# Применить миграции БД
npm run migrate

# Перезапустить pm2
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo "✅ Deploy complete. Status:"
pm2 list
