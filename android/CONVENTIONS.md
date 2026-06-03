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
| `AuthRepository` | `me()` | `Result<UserProfile>` (профиль + серверный триал) |
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
| `ActionsRepository` | `logAction(plantingId, type, notes?)` | `Result<ActionLog>` |
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
| `plantings` | `stage` | `sowing`, `sprouted`, `growing`, `flowering`, `harvesting`, `done` |
| `plantings` | `conditions` | `soil`, `greenhouse` |

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

Порядок: `sowing → sprouted → growing → flowering → harvesting → done`

Определены в `PlantingsScreen.kt`:
```kotlin
val STAGE_ORDER = listOf("sowing", "sprouted", "growing", "flowering", "harvesting", "done")
val STAGE_LABELS = mapOf("sowing" to "Посеяно", ...)
```

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

**Нельзя делать `git pull` на VPS без предварительного коммита и пуша локально.**

Порядок всегда такой:

```bash
# 1. ЛОКАЛЬНО — сначала коммит и пуш
git add -A
git commit -m "feat/fix: описание"
git push origin <branch>

# 2. ТОЛЬКО ПОТОМ — на VPS (из PowerShell)
cd /var/www/dacha-api/backend
git stash          # если есть локальные правки на VPS
git pull origin <branch>
npm run migrate    # если были новые миграции
pm2 restart dacha-api
```

> Если пропустить шаг 1 — `git pull` не принесёт новый код, и деплой бессмысленен.

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

## 16. Авто-заметки к действиям — фильтр

При отображении `action.notes` в журнале, карточке посадки и экране "Сегодня" — всегда проверять через `isAutoGeneratedNote(note, type, cropName)` перед показом. Авто-заметки имеют формат `"Название: Культура"` (бэкенд пишет `task.title = \`${care_task_name}: ${crop_name}\``). Показывать только вручную введённые заметки.

При сохранении нового действия — **не** передавать `task.title` как `initialNotes` в `ActionLogBottomSheet` (было исправлено: `quickActionNotes = null` всегда).
