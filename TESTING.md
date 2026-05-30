# Структура тестов — Календарь дачника

## Введение: что тестируем и зачем

Проект состоит из двух частей: **бэкенд** (Node.js/Fastify) и **Android-приложение** (Kotlin/Jetpack Compose). Для каждой части — своя стратегия.

Общий принцип: тестируем логику, а не инфраструктуру. Не нужно проверять, что Fastify умеет принимать запросы или что Retrofit умеет делать HTTP — нужно проверять, что **наша** логика работает правильно.

---

## Часть 1. Бэкенд (Node.js)

### Инструменты

```
npm install --save-dev vitest @vitest/coverage-v8 supertest
```

- **Vitest** — тест-раннер (быстрее Jest, отлично работает с ESM)
- **Supertest** — для интеграционных HTTP-тестов поверх Fastify
- Тестовая БД: отдельная PostgreSQL с `.env.test`, накатываем миграции перед тестами

Добавить в `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

### Структура папок

```
backend/
└── src/
    └── __tests__/
        ├── helpers/
        │   ├── buildApp.js        # фабрика Fastify-инстанса для тестов
        │   └── db.js              # тестовое соединение + хелперы сидирования
        ├── auth.test.js
        ├── gardens.test.js
        ├── plantings.test.js
        ├── actions.test.js
        ├── harvests.test.js
        ├── today.test.js
        ├── recommendations.test.js
        ├── analytics.test.js
        ├── reminders.test.js
        └── unit/
            ├── todayLogic.test.js   # чистая бизнес-логика без БД
            └── weatherService.test.js
```

---

### `helpers/buildApp.js`

```js
import Fastify from 'fastify'
import app from '../../app.js'  // регистрация всех плагинов/роутов

export async function buildApp() {
  const fastify = Fastify()
  await fastify.register(app, { 
    db: testDb,          // подключаем тестовую БД
    jwtSecret: 'test-secret'
  })
  await fastify.ready()
  return fastify
}
```

---

### auth.test.js

Что тестируем: регистрация, логин, защита роутов.

```
✓ POST /auth/register — успешная регистрация, возвращает token + user
✓ POST /auth/register — повторный email возвращает 409
✓ POST /auth/register — невалидный email возвращает 400
✓ POST /auth/register — пароль < 6 символов возвращает 400
✓ POST /auth/login — успешный логин, возвращает token
✓ POST /auth/login — неверный пароль возвращает 401
✓ POST /auth/login — несуществующий email возвращает 401
✓ GET /auth/me — с валидным токеном возвращает профиль
✓ GET /auth/me — без токена возвращает 401
✓ GET /auth/me — с истёкшим токеном возвращает 401
```

---

### gardens.test.js

```
✓ POST /gardens — создаёт участок для текущего пользователя
✓ GET /gardens — возвращает только участки текущего пользователя (не чужие)
✓ GET /gardens/:id — 404 для чужого участка
✓ PATCH /gardens/:id — обновляет name/soil_type
✓ DELETE /gardens/:id — удаляет, возвращает 200
✓ DELETE /gardens/:id — чужой участок возвращает 404
```

---

### plantings.test.js

```
✓ POST /plantings — создаёт посадку со stage='sowing'
✓ POST /plantings — planted_at по умолчанию = NOW()
✓ GET /plantings?garden_id= — фильтрует по участку
✓ GET /plantings — возвращает только посадки текущего пользователя
✓ GET /plantings/:id — 404 для чужой посадки
✓ PATCH /plantings/:id/stage — переход sprouted → growing → done
✓ PATCH /plantings/:id/stage — 404 для несуществующей посадки
```

---

### actions.test.js

```
✓ POST /actions — логирует watering
✓ POST /actions — принимает и action_type и type (обратная совместимость)
✓ GET /actions?planting_id= — возвращает только действия текущего пользователя
✓ GET /actions — лимит по умолчанию 50 записей
✓ GET /actions — не возвращает действия по чужим посадкам
```

---

### harvests.test.js

```
✓ POST /harvests — создаёт запись с weight_kg и quantity
✓ POST /harvests — harvested_at = NOW()
✓ GET /harvests?garden_id= — фильтрует по участку
✓ GET /harvests — возвращает crop_name из JOIN с crops
✓ GET /harvests — изоляция по user_id
```

---

### today.test.js

Самый важный эндпоинт — больше всего кейсов.

```
✓ GET /today?garden_id= — 400 без garden_id
✓ GET /today?garden_id= — 404 для чужого участка
✓ GET /today — возвращает weather: null если погода не загружалась
✓ GET /today — возвращает tasks: [] если нет посадок
✓ GET /today — frost_alert появляется когда frost_risk=true И культура frost_sensitive=true
✓ GET /today — frost_alert НЕ появляется если культура не frost_sensitive
✓ GET /today — watering_due появляется когда дней без полива >= watering_freq_days
✓ GET /today — watering_due НЕ появляется если полили сегодня
✓ GET /today — transplant_due для посадок со stage='sprouted' и истёкшим transplant_days
✓ GET /today — harvest_due для stage in (growing, flowering, harvesting) при истёкшем harvest_days
✓ GET /today — возвращает не более 5 задач (tasks.length <= 5)
✓ GET /today — сортировка: frost_alert всегда первым (priority=1)
✓ GET /today — reminders_today считает напоминания в окне -1h..+24h
```

---

### unit/todayLogic.test.js

Если вынести логику сборки задач в чистую функцию `buildTasks(plantings, weather, lastWatered, today)` — её можно тестировать без БД вообще. Рекомендую это сделать.

```
✓ watering overdue рассчитывается корректно (граничный случай: ровно N дней)
✓ daysSincePlanting считается правильно при planted_at = сегодня (0 дней)
✓ задачи сортируются по priority ASC, потом по days_overdue DESC
✓ при нескольких посадках frost_alert генерируется для каждой frost_sensitive
```

---

### analytics.test.js

```
✓ GET /analytics — возвращает total_harvests за период
✓ GET /analytics — фильтр по garden_id
✓ GET /analytics — изоляция по user_id
```

---

### reminders.test.js

```
✓ POST /reminders — создаёт напоминание с remind_at
✓ GET /reminders — возвращает только напоминания текущего пользователя
✓ PATCH /reminders/:id — обновляет is_sent
✓ DELETE /reminders/:id — удаляет
```

---

### unit/weatherService.test.js

Мокируем `node-fetch`, тестируем парсинг ответа Open-Meteo.

```
✓ parseWeather() — frost_risk=true когда min_temp_c < 2
✓ parseWeather() — heat_risk=true когда max_temp_c > 35
✓ parseWeather() — корректно маппит condition из weathercode
✓ fetchAndSave() — при сетевой ошибке не бросает исключение (graceful fail)
```

---

## Часть 2. Android (Kotlin)

### Инструменты

Добавить в `build.gradle.kts`:
```kotlin
testImplementation("junit:junit:4.13.2")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
testImplementation("io.mockk:mockk:1.13.11")
testImplementation("app.cash.turbine:turbine:1.1.0")  // для тестирования Flow

androidTestImplementation("androidx.test.ext:junit:1.1.5")
androidTestImplementation("androidx.compose.ui:ui-test-junit4")
```

- **MockK** — моки на Kotlin (лучше Mockito для корутин)
- **Turbine** — тестирование `StateFlow` / `Flow`
- **Coroutines Test** — `runTest`, `TestDispatcher`

---

### Структура папок

```
app/src/
├── test/java/ru/dachakalend/app/        ← unit-тесты (без Android)
│   ├── auth/
│   │   └── AuthViewModelTest.kt
│   ├── today/
│   │   └── TodayViewModelTest.kt
│   ├── plantings/
│   │   └── PlantingsViewModelTest.kt
│   ├── harvest/
│   │   └── HarvestViewModelTest.kt
│   ├── actions/
│   │   └── ActionLogViewModelTest.kt
│   ├── repository/
│   │   ├── AuthRepositoryTest.kt
│   │   └── TodayRepositoryTest.kt
│   └── utils/
│       └── ParseErrorTest.kt
└── androidTest/java/ru/dachakalend/app/ ← UI-тесты (нужен эмулятор)
    ├── LoginScreenTest.kt
    ├── TodayScreenTest.kt
    └── NavigationTest.kt
```

---

### AuthViewModelTest.kt

```kotlin
// Мокируем AuthRepository, проверяем UiState

✓ login() — при успехе UiState переходит в Success
✓ login() — при ошибке 401 UiState переходит в Error с текстом "Неверный email"
✓ login() — во время запроса UiState = Loading
✓ register() — при 409 UiState.Error содержит "уже существует"
✓ isLoggedIn() — возвращает true если токен есть в TokenStorage
```

Пример теста:
```kotlin
@Test
fun `login success updates state to Success`() = runTest {
    val mockRepo = mockk<AuthRepository>()
    coEvery { mockRepo.login(any(), any()) } returns Result.Success(fakeUser)
    
    val vm = AuthViewModel(mockRepo)
    vm.login("test@test.com", "password")
    
    vm.uiState.test {
        val state = awaitItem()
        assert(state is AuthUiState.Success)
    }
}
```

---

### TodayViewModelTest.kt

```kotlin
✓ init — запускает loadToday() и registerPushToken() параллельно
✓ loadToday() — при успехе обоих запросов UiState = Success с данными
✓ loadToday() — если todayRepo падает, UiState = Error
✓ loadToday() — если recsRepo падает, UiState = Error  
✓ loadToday() — Loading устанавливается до запроса
✓ uiState — начальное значение Loading
```

---

### PlantingsViewModelTest.kt

```kotlin
✓ loadPlantings() — загружает список посадок
✓ addPlanting() — после успеха список обновляется
✓ updateStage() — меняет stage у нужной посадки в списке
✓ updateStage() — при ошибке показывает сообщение об ошибке
```

---

### HarvestViewModelTest.kt

```kotlin
✓ loadHarvests() — возвращает список с crop_name
✓ addHarvest() — при weight_kg=0 показывает ошибку валидации (если реализована)
✓ addHarvest() — обновляет список после успеха
```

---

### ActionLogViewModelTest.kt

```kotlin
✓ logAction(watering) — создаёт action_log с типом watering
✓ logAction() — после успеха обновляет список действий
✓ loadActions(plantingId) — фильтрует по planting_id
```

---

### AuthRepositoryTest.kt

```kotlin
// Мокируем DachaApi и TokenStorage

✓ login() — при успешном ответе API сохраняет токен в TokenStorage
✓ login() — возвращает Result.Success с UserProfile
✓ login() — при HTTP 401 возвращает Result.Error("Неверный email или пароль")
✓ login() — при "Unable to resolve host" возвращает Result.Error("Нет соединения")
✓ register() — при 409 возвращает Result.Error("уже существует")
✓ logout() — вызывает tokenStorage.clearToken()
✓ isLoggedIn() — true если tokenStorage.getToken() != null
```

---

### ParseErrorTest.kt

Чистые unit-тесты без моков — тестируем `parseError()`:

```kotlin
✓ "401" в сообщении → "Неверный email или пароль"
✓ "409" в сообщении → "Пользователь с таким email уже существует"
✓ "Unable to resolve host" → "Нет соединения с сервером"
✓ null message → "Неизвестная ошибка"
```

---

### UI-тесты (androidTest)

Запускаются на эмуляторе. Пишутся в последнюю очередь — они медленные.

**LoginScreenTest.kt:**
```kotlin
✓ кнопка "Войти" задизейблена при пустом email
✓ при вводе невалидного email показывается подсказка об ошибке
✓ нажатие "Войти" вызывает vm.login()
```

**TodayScreenTest.kt:**
```kotlin
✓ в состоянии Loading показывается индикатор загрузки
✓ в состоянии Success показываются карточки задач
✓ в состоянии Error показывается кнопка "Повторить"
✓ нажатие на задачу типа watering_due открывает ActionLogBottomSheet
```

---

## Приоритет внедрения

Делать в таком порядке — от самого важного:

1. **Сначала** — бэкенд unit-тесты (`todayLogic.test.js`, `weatherService.test.js`). Не нужна БД, быстро пишутся.
2. **Потом** — интеграционные тесты бэкенда (`auth.test.js`, `today.test.js`). Самые критичные роуты.
3. **Потом** — Android unit-тесты ViewModels и Repositories.
4. **В конце** — Android UI-тесты. Медленные, пишутся только для ключевых сценариев.

---

## Запуск

```bash
# Бэкенд
cd backend
npm test                   # все тесты
npm run test:coverage      # с отчётом покрытия

# Android (в Android Studio или терминале)
./gradlew test             # unit-тесты
./gradlew connectedAndroidTest  # UI-тесты (нужен эмулятор)
```

---

## Целевое покрытие для MVP

| Модуль | Целевое покрытие |
|---|---|
| `today.js` (бизнес-логика задач) | 90%+ |
| `auth.js` | 85%+ |
| `AuthRepository.kt` | 90%+ |
| `TodayViewModel.kt` | 80%+ |
| Остальные роуты/VM | 70%+ |

Покрытие — не самоцель. 70% осмысленных тестов лучше 100% формальных.
