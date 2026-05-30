# Android Code Conventions — Календарь дачника

> **Правило для Claude**: перед написанием любого нового Repository, ViewModel или экрана —
> прочитать хотя бы один аналогичный существующий файл. Проверить сигнатуры методов через grep.
> В конце каждой сессии актуализировать этот файл, если добавились новые паттерны.

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

---

### Правило слияния в main

Слияние выполняется **только после проверки билда** на устройстве/эмуляторе. Правила:

1. **Squash-merge** — одна ветка = один или несколько осмысленных коммитов, не «WIP».
2. Формат сообщения коммита: `feat(sprintN): краткое описание` / `fix(экран): что исправлено`
3. Перед merge убедиться, что `summary.md` обновлён (задача отмечена `[x]`).
4. После merge — удалить ветку локально и на remote:

```bash
# На устройстве/эмуляторе билд прошёл ✅
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

### ❌ Нельзя
```kotlin
// kotlin.Result + runCatching — не использовать
suspend fun getCrops(): kotlin.Result<List<Crop>> = runCatching { api.getCrops() }
result.fold(onSuccess = { ... }, onFailure = { ... })
```

### ✅ Правильно — Repository
```kotlin
suspend fun getCrops(): Result<List<Crop>> = try {
    Result.Success(api.getCrops())
} catch (e: Exception) {
    Result.Error(e.message ?: "Ошибка загрузки")
}
```

### ✅ Правильно — ViewModel
```kotlin
when (val result = repository.getCrops()) {
    is Result.Success -> { /* result.data */ }
    is Result.Error   -> { /* result.message */ }
    is Result.Loading -> Unit
}
```

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
| `saveToken(token)` | Сохранить токен после логина |
| `saveGardenId(id)` | Сохранить ID сада после создания |
| `clearToken()` | Выход из аккаунта |

---

## 3. Методы репозиториев

Перед вызовом метода репозитория — проверить сигнатуру в файле.

| Репозиторий | Метод | Возвращает |
|---|---|---|
| `TodayRepository` | `getToday()` | `Result<TodayResponse>` |
| `AuthRepository` | `login(email, password)` | `Result<UserProfile>` |
| `AuthRepository` | `register(name, email, password)` | `Result<UserProfile>` |
| `GardenRepository` | `loadGardens()` | `Result<List<Garden>>` |
| `GardenRepository` | `createGarden(name, region)` | `Result<Garden>` |
| `GardenRepository` | `hasGarden()` | `Boolean` |
| `CropsRepository` | `getCrops(category?)` | `Result<List<Crop>>` |
| `CropsRepository` | `getCrop(id)` | `Result<Crop>` |
| `PlantingsRepository` | `getPlantings(gardenId?)` | `Result<List<Planting>>` |
| `PlantingsRepository` | `createPlanting(request)` | `Result<Planting>` |
| `PlantingsRepository` | `updateStage(plantingId, stage)` | `Result<Planting>` |
| `ActionsRepository` | `getActions(plantingId)` | `Result<List<ActionLog>>` |
| `ActionsRepository` | `logAction(plantingId, type, notes?)` | `Result<ActionLog>` |
| `ReminderRepository` | `getReminders()` | `Result<List<Reminder>>` |
| `ReminderRepository` | `createReminder(request)` | `Result<Reminder>` |

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

## 5. Moshi JSON аннотации (Kotlin 2.3+ / AGP 9+)

**Важно:** с Kotlin 2.3+ и AGP 9.0 использовать `@Json` **без** `@field:` префикса.

### ❌ Нельзя (Kotlin 2.3+ не применяет к полю)
```kotlin
@field:Json(name = "garden_id") val gardenId: Int
```

### ✅ Правильно
```kotlin
@Json(name = "garden_id") val gardenId: Int
```

Причина: флаг `-Xannotation-default-target=param-property` был удалён в Kotlin 2.3+. Без него `@field:Json` не подхватывается Moshi KSP при генерации адаптеров. `@Json` без site-target применяется к параметру конструктора — именно там Moshi KSP его и ищет.

---

## 6. Репозитории (Спринты 4–5)

| Репозиторий | Метод | Возвращает |
|---|---|---|
| `WeatherRepository` | `getWeather()` | `Result<WeatherSnapshot>` |
| `RecommendationsRepository` | `getRecommendations()` | `Result<List<Recommendation>>` |
| `HarvestRepository` | `getHarvests(gardenId?)` | `Result<List<Harvest>>` |
| `HarvestRepository` | `addHarvest(plantingId, weightKg?, quantity?, notes?)` | `Result<Harvest>` |
| `AnalyticsRepository` | `getSummary()` | `Result<AnalyticsSummary>` |
| `AnalyticsRepository` | `exportActionsIntent()` | `Result<Intent>` (Share chooser) |

`AnalyticsRepository` требует `@ApplicationContext` — использует `FileProvider` для CSV-экспорта.

---

## 5. DI — правила

- Все репозитории — `@Singleton` + `@Inject constructor`
- ViewModels — `@HiltViewModel` + `@Inject constructor`
- `Context` в не-Android классах получать через `@ApplicationContext` (см. `TokenStorage`, `ReminderScheduler`)
- WorkManager Workers — через `@HiltWorker` + `@AssistedInject`

---

## 6. Навигация

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

## 7. Стадии посадки

Порядок: `sowing → sprouted → growing → flowering → harvesting → done`

Определены в `PlantingsScreen.kt`:
```kotlin
val STAGE_ORDER = listOf("sowing", "sprouted", "growing", "flowering", "harvesting", "done")
val STAGE_LABELS = mapOf("sowing" to "Посеяно", ...)
```

---

## История изменений

| Дата | Спринт | Что добавлено |
|---|---|---|
| 2026-05-28 | Sprint 3 | Создан файл. Добавлены паттерны Result, TokenStorage, методы всех репозиториев, структура ViewModel, навигация, стадии посадки |
| 2026-05-29 | Sprint 4 | Добавлены WeatherRepository, RecommendationsRepository |
| 2026-05-29 | Sprint 5 | Git-правила (раздел 0): именование веток, squash-merge в main. HarvestRepository |
| 2026-05-30 | Sprint 5 | AnalyticsRepository (getSummary, exportActionsIntent), AnalyticsScreen + AnalyticsViewModel, FileProvider для CSV-экспорта, маршрут Screen.Analytics в BottomNav |
