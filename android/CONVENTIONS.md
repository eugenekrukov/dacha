# Android Code Conventions — Календарь дачника

> **Правило для Claude**: перед написанием любого нового Repository, ViewModel или экрана —
> прочитать хотя бы один аналогичный существующий файл. Проверить сигнатуры методов через grep.
> В конце каждой сессии актуализировать этот файл, если добавились новые паттерны.
>
> **Бэкенд-конвенции**: `backend/CONVENTIONS.md` — внешние API, деплой, переменные окружения.

---

## 0. Git — правила веток и слияний

### Создание ветки

Claude создаёт ветку **перед началом работы над фичей** (не после). Правило именования:

| Тип работы | Шаблон | Пример |
|---|---|---|
| Новый спринт / фича | `feature/<sprint>-<slug>` | `feature/sprint5-harvest` |
| Исправление бага | `fix/<короткое-описание>` | `fix/weather-null-crash` |
| Рефакторинг | `refactor/<что-рефакторим>` | `refactor/today-viewmodel` |
| Документация / конвенции | `docs/<что>` | `docs/conventions-update` |

**Команда для разработчика** — выдаётся в начале сессии, до первого коммита:
```bash
git checkout -b feature/sprintN-slug
```

> Claude не переключает ветку сам — он пишет команду, которую выполняет разработчик.

### Правило слияния в main

Слияние выполняется **только после проверки билда** на устройстве/эмуляторе. Правила:

1. **Squash-merge** — одна ветка = один или несколько осмысленных коммитов, не «WIP».
2. Формат сообщения коммита: `feat(sprintN): краткое описание` / `fix(экран): что исправлено`
3. Перед merge убедиться, что `summary.md` обновлён (задача отмечена `[x]`).
4. После merge — удалить ветку локально и на remote:

```bash
git checkout main
git merge --squash feature/sprintN-slug
git commit -m "feat(sprintN): описание всего что сделано в ветке"
git push origin main
git branch -d feature/sprintN-slug
git push origin --delete feature/sprintN-slug
```

5. **Никогда не мержить** если:
   - билд не собирается (ошибки компилятора)
   - в `summary.md` задача ещё в статусе `[ ]`

---

## 1. Кастомный Result

В проекте используется **собственный** `sealed class Result`, объявленный в `TodayRepository.kt`:

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
```

### Нельзя
```kotlin
// kotlin.Result + runCatching — не использовать
suspend fun getCrops(): kotlin.Result<List<Crop>> = runCatching { api.getCrops() }
result.fold(onSuccess = { ... }, onFailure = { ... })
```

### Правильно — Repository
```kotlin
suspend fun getCrops(): Result<List<Crop>> = try {
    Result.Success(api.getCrops())
} catch (e: Exception) {
    Result.Error(e.message ?: "Ошибка загрузки")
}
```

### Правильно — ViewModel
```kotlin
when (val result = repository.getCrops()) {
    is Result.Success -> { /* result.data */ }
    is Result.Error   -> { /* result.message */ }
    is Result.Loading -> Unit
}
```

> **Исключение**: `runCatching` допустим в UI-слое для парсинга дат (например, `LocalDate.parse`),
> где исключение — ожидаемая ситуация, а не сетевая ошибка.

---

## 2. Получение gardenId

Текущий сад хранится в `TokenStorage`. Не нужно вызывать API — достаточно:

```kotlin
val gardenId = tokenStorage.getGardenId()   // -1 если не выбран
if (gardenId == -1) return Result.Error("Участок не выбран")
```

**Методы TokenStorage:**

| Метод | Описание |
|---|---|
| `getToken(): String?` | JWT токен, null если не залогинен |
| `getGardenId(): Int` | ID текущего сада, -1 если отсутствует |
| `hasGarden(): Boolean` | true если сад уже создан |
| `saveToken(token)` | Сохранить токен после логина |
| `saveGardenId(id)` | Сохранить ID сада после создания |
| `clearToken()` | Выход из аккаунта |
| `saveClimateZone(zone?)` | Сохранить климатическую зону участка |
| `getClimateZone(): String?` | Получить климатическую зону ("3"–"6") |

---

## 3. Методы репозиториев

Перед вызовом метода репозитория — проверить сигнатуру в файле.

| Репозиторий | Метод | Возвращает |
|---|---|---|
| `TodayRepository` | `getToday()` | `Result<TodayResponse>` |
| `AuthRepository` | `login(email, password)` | `Result<UserProfile>` |
| `AuthRepository` | `register(name, email, password)` | `Result<UserProfile>` |
| `AuthRepository` | `me()` | `Result<UserProfile>` (профиль + серверный триал/подписка) |
| `AuthRepository` | `syncSubscription(active)` | `Unit` (best-effort, шлёт статус подписки на сервер) |
| `GardenRepository` | `loadGardens()` | `Result<List<Garden>>` |
| `GardenRepository` | `createGarden(name, region, city?)` | `Result<Garden>` |
| `GardenRepository` | `hasGarden()` | `Boolean` |
| `CropsRepository` | `getCrops(category?)` | `Result<List<Crop>>` |
| `CropsRepository` | `getCrop(id)` | `Result<Crop>` |
| `CropsRepository` | `getClimateZone()` | `String?` |
| `PlantingsRepository` | `getPlantings(gardenId?)` | `Result<List<Planting>>` |
| `PlantingsRepository` | `createPlanting(request)` | `Result<Planting>` |
| `PlantingsRepository` | `updateStage(plantingId, stage)` | `Result<Planting>` |
| `PlantingsRepository` | `updateInfo(plantingId, request)` | `Result<Planting>` |
| `PlantingsRepository` | `deletePlanting(plantingId)` | `Result<Unit>` |
| `ActionsRepository` | `getActions(plantingId)` | `Result<List<ActionLog>>` |
| `ActionsRepository` | `logAction(plantingId, type, notes?, auto?)` | `Result<ActionLog>` (auto=true — авто-заметка, скрыта в журнале) |
| `ReminderRepository` | `getReminders()` | `Result<List<Reminder>>` |
| `ReminderRepository` | `createReminder(request)` | `Result<Reminder>` |
| `CalendarRepository` | `getCalendarData()` | `Result<CalendarData>` |
| `WeatherRepository` | `getWeather()` | `Result<WeatherSnapshot>` |
| `RecommendationsRepository` | `getRecommendations()` | `Result<List<Recommendation>>` |
| `HarvestRepository` | `getHarvests(gardenId?)` | `Result<List<Harvest>>` |
| `HarvestRepository` | `addHarvest(plantingId, weightKg?, quantity?, notes?)` | `Result<Harvest>` |
| `AnalyticsRepository` | `getSummary()` | `Result<AnalyticsSummary>` |
| `AnalyticsRepository` | `exportActionsIntent()` | `Result<Intent>` (Share chooser) |

> `AnalyticsRepository` требует `@ApplicationContext` — использует `FileProvider` для CSV-экспорта.

---

## 4. Структура ViewModel

```kotlin
@HiltViewModel
class XxxViewModel @Inject constructor(
    private val repository: XxxRepository,
    private val tokenStorage: TokenStorage   // если нужен gardenId
) : ViewModel() {

    private val _uiState = MutableStateFlow(XxxUiState())
    val uiState: StateFlow<XxxUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = repository.getData()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(data = result.data, isLoading = false)
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }
}
```

UiState — **data class с дефолтами** (не sealed class), если на экране один основной контент:
```kotlin
data class XxxUiState(
    val items: List<Xxx> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)
```

Sealed UiState используется когда экран имеет принципиально разные состояния (см. `TodayUiState`).

---

## 5. Сверка моделей с бэкендом — обязательно

Перед написанием или изменением любого `data class` модели (Models.kt) — открыть соответствующий роут в `backend/src/routes/` и сверить **имена полей**.

Правило: JSON-имя поля = имя столбца в БД = то, что возвращает `RETURNING *` или `SELECT`.

Частые ошибки:
- Колонка `action_type` → нужен `@Json(name = "action_type")`, а не просто `val type`
- Колонка `planted_at` → нужен `@Json(name = "planted_at")`, а не `sown_at`
- Поля которых нет в БД (`location`, `title`) — не добавлять как non-nullable
- Имя таблицы в SQL-запросах: `action_logs` (не `actions`)

**Чеклист перед коммитом модели:**
```
[ ] Открыл роут бэкенда и нашёл что реально возвращается (RETURNING * или SELECT поля)
[ ] Все snake_case поля покрыты @Json(name = "...")
[ ] Non-nullable поля (без ?) точно присутствуют в ответе бэкенда
[ ] Нет полей которых нет в схеме БД
[ ] Имена таблиц в SQL проверены по 001_init.sql
```

---

## 5a. Перечисляемые значения в SQL-запросах — сверка с Android

**Проблема**: Android пишет значения enum-полей в БД через POST-запросы. SQL-запросы на бэкенде читают эти же значения. Раздел 5 проверяет имена полей, но не строковые константы внутри WHERE-условий.

**Правило**: при написании любого SQL-запроса с `WHERE field = 'значение'` — проверить, что именно пишет Android в это поле.

### Канонические значения по таблицам

| Таблица | Колонка | Допустимые значения |
|---|---|---|
| `action_logs` | `action_type` | `watering`, `fertilizing`, `treatment`, `other` |
| `plantings` | `stage` | `sowing`, `transplanted`, `growing`, `flowering`, `harvesting`, `done` (стадия `sprouted` удалена) |
| `plantings` | `conditions` | `soil`, `greenhouse` |
| `plantings` | `sowing_method` | `seedling` (через рассаду), `direct` (прямой посев в грунт) |

> **Источник истины**: `ACTION_TYPES` в `ActionLogViewModel.kt`, `STAGE_ORDER` в `PlantingsScreen.kt`.

**Чеклист при написании SQL-запроса с WHERE по enum-полю:**
```
[ ] Открыл Android-код и нашёл где это поле заполняется (ViewModel / Repository)
[ ] Строковое значение в SQL совпадает с тем, что пишет Android
[ ] Если значение не очевидно — добавил его в таблицу выше
```

> **Как нашли баг**: `today.js` и `recommendations.js` запрашивали `action_type = 'watered'`,
> тогда как Android пишет `'watering'`. Из-за этого рекомендации ложно показывали полив
> для только что политых растений.

---

## 6. Moshi JSON аннотации (Kotlin 2.3+ / AGP 9+)

**Важно:** с Kotlin 2.3+ и AGP 9.0 использовать `@Json` **без** `@field:` префикса.

### Нельзя (Kotlin 2.3+ не применяет к полю)
```kotlin
@field:Json(name = "garden_id") val gardenId: Int
```

### Правильно
```kotlin
@Json(name = "garden_id") val gardenId: Int
```

Причина: флаг `-Xannotation-default-target=param-property` был удалён в Kotlin 2.3+. Без него
`@field:Json` не подхватывается Moshi KSP при генерации адаптеров. `@Json` без site-target
применяется к параметру конструктора — именно там Moshi KSP его и ищет.

---

## 7. DI — правила

- Все репозитории — `@Singleton` + `@Inject constructor`
- ViewModels — `@HiltViewModel` + `@Inject constructor`
- `Context` в не-Android классах получать через `@ApplicationContext` (см. `TokenStorage`, `ReminderScheduler`)
- WorkManager Workers — через `@HiltWorker` + `@AssistedInject`

---

## 8. Навигация

Маршруты объявлены в `Navigation.kt` как `sealed class Screen(val route: String)`.
BottomBar скрывается на экранах из `screensWithoutBottomBar`.

Переход с параметром:
```kotlin
// Объявление
object CropDetail : Screen("crop_detail/{cropId}") {
    fun route(cropId: Int) = "crop_detail/$cropId"
}
// Вызов
navController.navigate(Screen.CropDetail.route(crop.id))
```

---

## 9. Стадии посадки

Зависят от **способа посадки** (`plantings.sowing_method`):
- **Через рассаду** (`seedling`): `sowing` → `transplanted` («Высажено в грунт») → `growing` → `flowering` → `harvesting` → `done`
- **Прямой посев** (`direct`): `sowing` → `growing` → … (стадии `transplanted` нет — пересадки не было)

Стадия `sprouted` («Взошло») **удалена** (её ничто не выставляло). Определены в `PlantingsScreen.kt`:
```kotlin
val STAGE_ORDER = listOf("sowing", "transplanted", "growing", "flowering", "harvesting", "done")
```

**Логика (бэкенд `todayLogic.js`)**:
- `transplant_due` («пора высаживать») — только `sowing_method='seedling'` + есть `transplant_days` + стадия `sowing`.
- `harvest_due` — для `direct` считается прямо по `harvest_days` (растёт в грунте с посева, стадия остаётся `sowing`); для рассады — после высадки (`growing`/`transplanted`/…).
- Подкормка: стадия `transplanted` трактуется как `growing` (так размечен `fertilizing_schedule`).
- Высадку логирует `ActionLogViewModel.logTransplanting` → стадия `transplanted`.
- Способ посадки выбирается в `PlantingSetupBottomSheet` (дефолт: есть `transplant_days` → «через рассаду») и меняется в `PlantingEditBottomSheet`.

---

## 10. UI — Solar Dacha Design System

> Полный манифест: `UI_MANIFEST.md` в корне проекта. Дизайн-система: `design-system/календарь-дачника/`.

### Шрифты

```kotlin
// Импортировать из theme
import ru.dachakalend.app.ui.theme.NunitoFamily

// ВСЕ тексты — только NunitoFamily
// Минимальный вес: FontWeight.Bold (700)
// Заголовки экранов: FontWeight.Black (900)
// Вспомогательный текст: FontWeight.SemiBold (600)
Text(text = "...", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)

// НЕ ИСПОЛЬЗОВАТЬ system fonts, Inter, Roboto
// НЕ ИСПОЛЬЗОВАТЬ FontWeight.Normal или FontWeight.Medium
```

### Токены темы

| Токен | Значение | Применение |
|-------|---------|-----------|
| `colorScheme.primary` | `#FF7B00` (оранжевый) | Кнопки, активные чипы, FAB |
| `colorScheme.background` | `#FFF8EB` (кремовый) | Фон всех экранов |
| `colorScheme.surface` | `Color.White` | Фон карточек (явно `Color.White` — не `surface`, т.к. Material3 добавляет tint) |
| `colorScheme.tertiary` | `#2E7D32` (зелёный) | Стадия посадки, следующая задача |
| `colorScheme.onSurfaceVariant` | `#9E7050` (коричневый) | Вспомогательный текст |

### Карточки

```kotlin
Card(
    modifier = Modifier.fillMaxWidth(),
    shape    = RoundedCornerShape(22.dp),
    colors   = CardDefaults.cardColors(containerColor = Color.White), // явно White!
    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
)
```

### Кнопки

```kotlin
Button(
    modifier = Modifier.fillMaxWidth().height(52.dp),
    shape    = RoundedCornerShape(16.dp)
) {
    Text("Текст", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false)
}
```

### FilterChip (пилюля)

```kotlin
FilterChip(
    selected = ...,
    onClick  = ...,
    shape    = RoundedCornerShape(100.dp),
    colors   = FilterChipDefaults.filterChipColors(
        selectedContainerColor = MaterialTheme.colorScheme.primary,
        selectedLabelColor     = Color.White
    ),
    label = { Text("Все", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
)
```

### Текст с переполнением (динамические данные)

```kotlin
Text(
    text     = cropName,           // может быть длинным
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
    softWrap = false               // кнопки — всегда softWrap = false
)
```

### TokenStorage — новые методы

| Метод | Описание |
|-------|---------|
| `getDismissedRecsForToday(): Set<String>` | Ключи рекомендаций, отклонённых СЕГОДНЯ |
| `addDismissedRec(key: String)` | Добавить отклонённую рекомендацию (с датой, автоочистка старых) |
| `savePendingTasks(tasks)` | Сохранить pending-задачи для badge и карточек посадок |
| `getPendingTasks(): Map<Int,String>` | Загрузить pending-задачи |
| `isIntroDone(): Boolean` | Были ли показаны intro-слайды |
| `setIntroDone()` | Отметить intro как просмотренный |
| `isCoachDone(): Boolean` | Был ли показан coach mark туториал |
| `setCoachDone()` | Отметить coach mark как завершённый |

---

## 13. Onboarding — Intro-слайды и Coach Marks

### Файлы

| Файл | Назначение |
|------|-----------|
| `ui/onboarding/TutorialIntroScreen.kt` | 4-слайдовый intro (показывается 1 раз до логина) |
| `ui/onboarding/CoachMarkOverlay.kt` | Coach mark оверлей + `CoachMarkController` |

### Intro-слайды

- Показываются при первом запуске (`!tokenStorage.isIntroDone()`)
- `startDestination` в `MainActivity` проверяет это условие
- После нажатия «Зарегистрироваться», «Войти» или «Пропустить» — вызывается `tokenStorage.setIntroDone()`
- Используют `HorizontalPager` с `@OptIn(ExperimentalFoundationApi::class)`

### Coach Marks

**Архитектура:**
- `CoachMarkController` живёт в `remember {}` в `MainActivity` — один инстанс на всё приложение
- `coachMarkSteps` — глобальный `val` в `CoachMarkOverlay.kt`, определяет 6 шагов
- Overlay рендерится в `Box` поверх `Scaffold` в `MainActivity` — перекрывает в том числе нав-бар

**Показ ровно один раз:**
- `CoachMarkController.showOnce()` защищён флагом `wasShown` — повторный вызов игнорируется
- В `TodayScreen` используется `LaunchedEffect(Unit)` (а не `LaunchedEffect(showCoachMark)`) — иначе перезапускается при каждом входе на экран

**Регистрация bounds:**
```kotlin
// Одиночный элемент
Modifier.coachTarget(controller, "weather")

// Секция из нескольких items в LazyColumn (title + cards)
Modifier.coachTargetUnion(controller, "tasks")   // на SectionTitle И на каждой карточке
```
`coachTargetUnion` накапливает union всех зарегистрированных rect. Перед сменой шага `controller.resetBounds(key)` сбрасывает накопленный rect.

**Nav bar bounds** регистрируются в `MainActivity` через `Modifier.onGloballyPositioned` на `NavigationBarItem`.

**Завершение:** `onDone = { tokenStorage.setCoachDone() }` передаётся в `CoachMarkOverlay`.

---

## 11. Монетизация — RuStore Billing

**Продукты** (создать в RuStore Консоль → Монетизация → Подписки):
- `dacha_pro_monthly` — 299 ₽/мес
- `dacha_pro_yearly` — 1990 ₽/год

**`RUSTORE_CONSOLE_APP_ID`** — числовой ID из RuStore Консоль → Приложения (заменить `TODO_REPLACE_WITH_REAL_APP_ID` в `build.gradle.kts`).

**Проверка доступа** — всегда через `SubscriptionManager.status` (StateFlow).
Не обращаться к RuStore напрямую из ViewModel — только через `SubscriptionManager`.

**Триал** — 7 дней с первого запуска, хранится в `TokenStorage.getFirstLaunchDate()`.
Дата не сбрасывается при выходе из аккаунта (намеренно).

**Paywall** открывается:
1. Автоматически при старте если `!subscriptionManager.isAccessAllowed()`
2. Из Настроек кнопкой "Купить"

---

## 12. Деплой на VPS — обязательный порядок

**Git-модель**: `main` — единственная интеграционная ветка (фичи вливаются `--ff-only`).
**VPS — read-only зеркало `origin/main`**: на сервере НИКОГДА не коммитят и не правят файлы под git.
Деплой — через `fetch + reset --hard origin/main`, а **НЕ `git pull`** (pull создаёт merge-коммит и
разводит серверный `main` с origin → ломает будущие деплои). Серверное состояние (`.env`, pm2) — вне git.

Порядок всегда такой:

```bash
# 1. ЛОКАЛЬНО — сначала коммит, ff-merge в main и пуш
git add -A && git commit -m "feat/fix: описание"
git checkout main && git merge --ff-only <branch> && git push origin main

# 2. ТОЛЬКО ПОТОМ — на VPS (ssh из PowerShell). Деплоим ТОЛЬКО dacha-api.
cd /var/www/dacha-api
git fetch origin && git reset --hard origin/main   # НЕ git pull
cd backend && npm install                          # если менялся package.json
sudo -u postgres psql -d dacha_db -f src/db/migrations/0XX_*.sql   # если есть новая миграция
pm2 restart dacha-api
```

> Если пропустить шаг 1 — `reset --hard origin/main` не принесёт новый код, и деплой бессмысленен.

---

## 14. ModalBottomSheet — insets

Всегда передавать `windowInsets = WindowInsets(0)` в каждый `ModalBottomSheet`. Обработка отступов — только через явный `navigationBarsPadding()` + `imePadding()` в контентном `Column`.

```kotlin
ModalBottomSheet(
    onDismissRequest = onDismiss,
    windowInsets = WindowInsets(0)          // отключаем встроенную обработку
) {
    Column(
        modifier = Modifier
            .navigationBarsPadding()        // явный отступ от nav bar
            .imePadding()                   // если есть текстовые поля
            .padding(horizontal = 16.dp)
            .padding(bottom = 16.dp)
    ) { ... }
}
```

---

## 15. Свайп-действия (SwipeActionsBox)

Для карточек с откладыванием/удалением использовать `SwipeActionsBox` из `TodayScreen.kt`:
- **Свайп вправо** (StartToEnd) → 🔔 Отложить → диалог "Напомнить завтра?"
- **Свайп влево** (EndToStart) → 🗑 Удалить → диалог подтверждения
- `confirmValueChange` всегда возвращает `false` — элемент снэпится обратно, диалог показывается через `pendingSnooze`/`pendingDelete` state

Ключи снуза/удаления:
- Рекомендации: `"${rec.type}:${rec.cropName}:${rec.message.take(30)}"`
- Задачи: `"${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"`

Персистирование — TokenStorage:
| Метод | Описание |
|---|---|
| `addDismissedRec(key)` | Скрыть рекомендацию на сегодня |
| `deleteRec(key)` | Удалить рекомендацию навсегда |
| `snoozeTask(key)` | Скрыть задачу на сегодня |
| `deleteTask(key)` | Удалить задачу навсегда |
| `getSnoozedTasksForToday()` | Задачи, отложенные сегодня |
| `getDeletedTasks()` | Навсегда удалённые задачи |
| `getDeletedRecs()` | Навсегда удалённые рекомендации |

---

## 16. Авто-заметки к действиям — серверный флаг `auto` (обновлено 2026-06-03)

Скрытие авто-подставленных заметок теперь по серверному полю `ActionLog.auto` (НЕ строковой
эвристикой — старая `isAutoGeneratedNote` удалена). В журнале и на экране «Сегодня» показывать
заметку только если `!action.auto`. При логировании из задачи дня `ActionLogBottomSheet` сам
вычисляет `auto = !initialNotes.isNullOrBlank() && notes == initialNotes` и шлёт в `logAction(..., auto)`.

## 17. Паттерны сессии 2026-06-03

- **Серверный триал/подписка/гейт**: `/auth/me` отдаёт `trialActive`/`trialDaysLeft`/`subscribed`.
  `SubscriptionManager.refresh()` берёт триал с сервера (фолбэк — TokenStorage) и синкает подписку
  (`syncSubscription(active)`). Backend гейтит POST `/actions`,`/plantings`,`/harvests` → **402**
  `subscription_required` при истёкшем триале без подписки. 402 = нет доступа (не путать с IDOR 403).
- **Иконки действий**: единый `ui/actions/ActionVisuals.kt actionIcon(type)` (Material Icons) —
  использовать и в журнале, и в селекторе. Эмодзи в UI действий не добавлять.
- **Автодополнение (город)**: `ExposedDropdownMenuBox` + `ExposedDropdownMenu` + `Modifier.menuAnchor()`
  (НЕ `DropdownMenu` в `Box` — он перекрывает поле и крадёт фокус). Список — под полем, поле редактируемо.
- **Реактивный счётчик задач**: `TokenStorage.pendingCount: StateFlow<Int>` (обновляется в
  `savePendingTasks`/`snoozeTask`/`logout`). В Compose — `collectAsState()`, не разовый вызов `getPendingCount()`.
- **Снятие pending**: только при реально записанном действии — колбэк `onActionLogged(loggedType)` в
  `ActionLogBottomSheet` → `PlantingsViewModel.onActionLogged(plantingId, loggedType)`. Снимаем из кэша
  **только если тип закрывает задачу** (`watering_due`→`watering`, `care_task_due`→`careTaskActionType()`
  и т.д.) — иначе после `/today` задача вернётся, а индикатор бы ложно пропал. `closeActionSheet()` pending НЕ трогает.

## 18. Просрочка ухода на экране «Посадки» (сессия 2026-06-03, фикс)

- **Источник истины — сервер, не кэш «Сегодня»**. Кэш `TokenStorage.pendingTasks` режется до топ-7 и
  теряет сгруппированные care-задачи (`planting_id: null`), поэтому просрочки не доходили до «Посадок».
- `GET /plantings` отдаёт по каждой посадке `overdue_care_task: { name, days_overdue }` — самую
  просроченную/наступившую невыполненную care-задачу. Чистая функция `getOverdueCareTask()` в
  `utils/todayLogic.js` (логика «выполнено» = `doneSinceDue`/`doneToday`, идентична `buildTasks`).
- На карточке посадки care-индикатор берётся из `planting.overdueCareTask` (Android `OverdueCareTask`),
  а `pendingAction` (кэш) — только для НЕ-care типов. Снуз care использует тот же ключ, что «Сегодня»:
  `"care_task_due:$plantingId:$cropName:$name"`.
- При открытии `ActionLogBottomSheet` с карточки — **преселект** типа/заметки из `overdueCareTask`/pending
  (как на «Сегодня»), чтобы пользователь записал именно закрывающее задачу действие.

## 19. Паттерны сессии 2026-06-03 (вторая итерация)

- **Маппинг care-задач — по ключевому слову** (`careTaskActionType` в `ActionLogViewModel.kt` и
  `utils/todayLogic.js`): имена в БД описательные («Первое окучивание», «Обработка от капустной мухи»).
  Синхронны бэкенд+Android. Незамапленные → `other`/`null`. Тип `treatment` добавлен в SQL-фильтры
  care-действий (`today.js`, `plantings.js`), иначе «Обработка» не закрывалась бы.
- **Заметка к действию**: имя действия в заметку НЕ пишем (`treatmentNote()`). Авто-подставляем только
  осмысленное: для подкормки — пример удобрения, для «Обработки» — препарат (`overdue_care_task.product`)
  или «от чего». Препараты — статическая карта `CARE_TASK_PRODUCT` в `todayLogic.js` (3 обработки),
  отдаётся в `overdue_care_task.product` и в задачах `/today` (`product`).
- **Авто-заметка реактивна**: в `ActionLogBottomSheet` подстановка живёт только пока выбран изначально
  предложенный тип (`selectedType == preselectedType`). Сменили действие — авто-текст исчезает
  (ручной текст не трогаем). Авто-заметка теперь осмысленна → пишется с `auto=false` (видна в журнале
  и «Сделано сегодня»); старое скрытие авто-дублей фактически не используется.
- **«Сегодня» перечитывается по ON_RESUME** (`DisposableEffect`, как «Посадки») — действия, записанные
  на других экранах, сразу появляются в «Сделано сегодня».
- **Бейдж BottomNav = `TokenStorage.pendingCount`**, но теперь это ЯВНЫЙ счётчик
  (`saveAttentionCount`), который считают ViewModel'ы функцией `attentionCount(plantings, pending, snoozed)`
  по тем же данным, что рисуют карточки (серверный `overdueCareTask` + non-care pending). Care в кэш
  `pendingTasks` больше НЕ кладётся (TodayViewModel фильтрует `care_task_due`). Это исключает «дрейф»
  бейджа. Снуз/лог действия пересчитывают счётчик.
- **Раскраска расписания** в `PlantingInfoBottomSheet` (`buildSchedule`): 🟢 выполнено (приглушённо,
  зачёркнуто) · 🔴 просрочено · ⚪ предстоит. «Выполнено» = действие нужного типа в окне
  `[дата_работы, дата_след_повтора)`. Урожай — нейтрально (логируется отдельно).

## 20. Промокоды — бесплатный доступ по коду (сессия 2026-06-04)

- **Два типа**: `lifetime` (навсегда) и `month` (30 дней, продлевается при повторном погашении).
  Коды одноразовые, генерируются вручную: `node scripts/gen-promo.js <lifetime|month> [count]`.
- **Серверный источник истины — отдельная колонка `users.promo_until`** (НЕ `subscription_until`):
  синхронизация подписки RuStore (`POST /auth/subscription active=false`) обнуляет `subscription_until`,
  и если бы промо лежало там — затёрлось бы. `hasAccess` = триал ИЛИ подписка ИЛИ `hasPromo(promo_until)`.
  lifetime = `promo_until` в далёком будущем (`LIFETIME_UNTIL` 2999), порог lifetime — `2900`.
- **Погашение** `POST /promo/redeem {code}`: атомарный claim
  `UPDATE promo_codes SET redeemed_by=$user WHERE code=$1 AND redeemed_by IS NULL RETURNING type`
  (без транзакции — claim-first исключает гонку). 404 `invalid_code`, 409 `code_already_used`.
  `/auth/me` отдаёт `promo_active`/`promo_lifetime` → `UserProfile`. Код нормализуется `trim().uppercase()`.
- **Android**: поле ввода на `PaywallScreen` → `PaywallViewModel.redeemPromo` →
  `SubscriptionManager.redeemPromo` (возвращает `PromoRedeemResponse`; после успеха `refresh()`).
  `SubscriptionStatus.isAccessAllowed` включает `isPromo`; в Настройках приоритет
  `подписка → промо → триал`, кнопка «Купить» скрыта при `isSubscribed || isPromo`.
- **Навигация Paywall — по явному событию `accessGranted`, НЕ по ambient-статусу.** Иначе экран,
  открытый из настроек при активном доступе (триал/промо/подписка), моментально закрывался бы.
  Покупка/восстановление/промокод выставляют `accessGranted=true`; промо ещё показывает Toast-подтверждение.
- **Поле ввода в скролле + клавиатура**: на прокручиваемой колонке Paywall — `Modifier.imePadding()`
  (манифест уже `windowSoftInputMode=adjustResize`), иначе клавиатура перекрывает поле промокода.

### Срок действия и произвольная длительность (доработка)

- **Миграция 018**: `promo_codes.duration_days` (NULL = lifetime, иначе N дней доступа) и
  `promo_codes.expires_at` (дедлайн АКТИВАЦИИ кода, NULL = бессрочно). Тип `days` для произвольного срока.
  `redeem` проверяет `expires_at` до claim → **410 `code_expired`**; `promo_until` считается по `duration_days`
  (фолбэк: `month`→30). `/auth/me` отдаёт `promo_until` (ISO) → `UserProfile.promoUntil` → `SubscriptionStatus.promoUntil`.
- **Скрипт**: `node scripts/gen-promo.js <lifetime|month|days N> [count] [--expires=YYYY-MM-DD]`.
- **«Купить» во время промо разрешена**: в Настройках кнопка скрыта только при `isSubscribed`
  (не при `isPromo`); Paywall показывает бейдж «Промокод активен до DD.MM.YYYY / навсегда».
  Покупка оформляется сразу (RuStore), доступ = промо ИЛИ подписка.
- **Формат даты**: `formatPromoDate(iso)` в `SettingsScreen.kt` (ISO `OffsetDateTime` → `DD.MM.YYYY`),
  импортируется и в Paywall.

## 21. Параметры посадки: тип (грунт/теплица) и количество (сессия 2026-06-04)

- **Полив — единый источник правды** `wateringIntervalDays(freqDays, conditions)` в
  `backend/utils/todayLogic.js`. Теплица → интервал КОРОЧЕ (×0.8 = поливать чаще), мин. 1 день,
  `Math.round`. Используется в `today.js`, `careRemindersJob.js`. **Android-зеркало** —
  `CalendarViewModel.kt` (та же формула ×0.8). Меняешь коэффициент — правь оба места.
- **Теплица защищает от заморозков**: per-посадочный `frost_alert` в `buildTasks` пропускается для
  `conditions==='greenhouse'`. Пуш заморозков на участок (`weatherJob`/`pushService`) — общий, остаётся.
- **`conditions`** задаётся чипами в `PlantingSetupBottomSheet`/`PlantingEditBottomSheet` (`soil`/`greenhouse`).
- **`quantity` → ожидаемый урожай**: `crops.yield_per_plant_kg` (миграция 019). `Planting.yieldPerPlantKg`
  приходит из `GET /plantings`. На «Информации о посадке» — «Ожидаемый урожай ~X кг» = `quantity × yield`.
  Для культур без данных (цветы) поле NULL → строка не показывается.
