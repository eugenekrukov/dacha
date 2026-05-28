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
  - `GET /dacha/health` → 200 OK ✅
  - `POST /dacha/auth/register` → токен + объект user ✅
  - `POST /dacha/auth/login` → токен + объект user ✅
  - `GET /dacha/auth/me` (с Bearer токеном) → полный профиль пользователя с `notification_settings` ✅
- Спринт 1 закрыт, прогресс обновлён до 20%
- Текущий активный спринт: **Спринт 2 — Главная и календарь**

---

## Сессия 3 — 2026-05-27: Спринт 2 — GET /today

### Что сделано
- Создан `backend/src/routes/today.js` — агрегирующий эндпоинт экрана «Сегодня»
- Логика: 4 типа задач с приоритетами — frost_alert (1) → transplant_due (2) → watering_due (3) → harvest_due (4) → reminder (5)
- Топ-5 задач, сортировка по приоритету и просроченности
- Зарегистрирован в `app.js` (`prefix: '/today'`)
- Задеплоен на VPS, протестирован: томат 30 дней без полива → задача `watering_due` ✅
- Прогресс обновлён до 28%

### Следующий шаг Спринта 2
- [ ] Экран «Сегодня» — Android UI (Погода + задачи + быстрые кнопки)
- [ ] Календарь работ (месячный/дневной вид)

---

---

## Сессия 4 — 2026-05-28: Android-структура проекта

### Что сделано
- Восстановлен сломанный `backend/src/app.js` (файл был обрезан на `} catch (err`), задеплоен на VPS
- Создан Android-проект `android/` на стеке: **Kotlin + Jetpack Compose + Hilt + Retrofit**
- Gradle Version Catalog (`libs.versions.toml`): AGP 8.3.2, Kotlin 1.9.23, Compose BOM 2024.05
- **Data-слой**: `DachaApi` (Retrofit), `AuthInterceptor`, `TokenStorage`, `TodayRepository`, `NetworkModule` (Hilt)
- **UI-слой**: `DachaCalendarTheme` (зелёная палитра, цвета по типу задачи), `TodayViewModel` (StateFlow), `TodayScreen` (Compose) — погода, карточки задач, быстрые кнопки
- `MainActivity` с `BottomNavigation`: Сегодня / Календарь / Посадки / Урожай
- Заглушки для CalendarScreen, PlantingsScreen, HarvestScreen

### Ключевые параметры
- Package: `ru.dachakalend.app` | minSdk: 26 | targetSdk: 34
- `BASE_URL` прописан в `buildConfigField` → `http://78.47.58.211/dacha/`
- Токен хранится в `SharedPreferences` через `TokenStorage`

### Следующий шаг
- Реализовать `CalendarScreen` (месячный/дневной вид) → закрыть Спринт 2
- Запустить на эмуляторе / реальном устройстве и проверить онбординг end-to-end

---

## Сессия 5 — 2026-05-28: Онбординг

### Что сделано
- `AuthRepository` — логин/регистрация, сохранение JWT в SharedPreferences
- `GardenRepository` — создание участка, сохранение `garden_id`
- `LoginScreen` + `RegisterScreen` + `AuthViewModel`
- `CreateGardenScreen` + `GardenViewModel` (dropdown регионов РФ)
- `MainActivity` определяет стартовый экран по токену и `garden_id`
- Флоу: нет токена → Login → Register → CreateGarden → TodayScreen
- Билд успешен, предупреждения компилятора устранены (KSP, `@OptIn`, `@field:Json`, `-Xannotation-default-target`)

### Осталось в Спринте 2
- CalendarScreen (месячный/дневной вид)

---

## 6. Команды для деплоя обновлений
```bash
# На VPS — обновить код
cd /var/www/dacha-api
git pull origin main
cd backend && npm install
pm2 reload dacha-api
```
