# Android Code Conventions вЂ” РљР°Р»РµРЅРґР°СЂСЊ РґР°С‡РЅРёРєР°

> **РџСЂР°РІРёР»Рѕ РґР»СЏ Claude**: РїРµСЂРµРґ РЅР°РїРёСЃР°РЅРёРµРј Р»СЋР±РѕРіРѕ РЅРѕРІРѕРіРѕ Repository, ViewModel РёР»Рё СЌРєСЂР°РЅР° вЂ”
> РїСЂРѕС‡РёС‚Р°С‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ Р°РЅР°Р»РѕРіРёС‡РЅС‹Р№ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ С„Р°Р№Р». РџСЂРѕРІРµСЂРёС‚СЊ СЃРёРіРЅР°С‚СѓСЂС‹ РјРµС‚РѕРґРѕРІ С‡РµСЂРµР· grep.
> Р’ РєРѕРЅС†Рµ РєР°Р¶РґРѕР№ СЃРµСЃСЃРёРё Р°РєС‚СѓР°Р»РёР·РёСЂРѕРІР°С‚СЊ СЌС‚РѕС‚ С„Р°Р№Р», РµСЃР»Рё РґРѕР±Р°РІРёР»РёСЃСЊ РЅРѕРІС‹Рµ РїР°С‚С‚РµСЂРЅС‹.

---

## 0. Git вЂ” РїСЂР°РІРёР»Р° РІРµС‚РѕРє Рё СЃР»РёСЏРЅРёР№

### РЎРѕР·РґР°РЅРёРµ РІРµС‚РєРё

Claude СЃРѕР·РґР°С‘С‚ РІРµС‚РєСѓ **РїРµСЂРµРґ РЅР°С‡Р°Р»РѕРј СЂР°Р±РѕС‚С‹ РЅР°Рґ С„РёС‡РµР№** (РЅРµ РїРѕСЃР»Рµ). РџСЂР°РІРёР»Рѕ РёРјРµРЅРѕРІР°РЅРёСЏ:

| РўРёРї СЂР°Р±РѕС‚С‹ | РЁР°Р±Р»РѕРЅ | РџСЂРёРјРµСЂ |
|---|---|---|
| РќРѕРІС‹Р№ СЃРїСЂРёРЅС‚ / С„РёС‡Р° | `feature/<sprint>-<slug>` | `feature/sprint5-harvest` |
| РСЃРїСЂР°РІР»РµРЅРёРµ Р±Р°РіР° | `fix/<РєРѕСЂРѕС‚РєРѕРµ-РѕРїРёСЃР°РЅРёРµ>` | `fix/weather-null-crash` |
| Р РµС„Р°РєС‚РѕСЂРёРЅРі | `refactor/<С‡С‚Рѕ-СЂРµС„Р°РєС‚РѕСЂРёРј>` | `refactor/today-viewmodel` |
| Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ / РєРѕРЅРІРµРЅС†РёРё | `docs/<С‡С‚Рѕ>` | `docs/conventions-update` |

**РљРѕРјР°РЅРґР° РґР»СЏ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°** вЂ” РІС‹РґР°С‘С‚СЃСЏ РІ РЅР°С‡Р°Р»Рµ СЃРµСЃСЃРёРё, РґРѕ РїРµСЂРІРѕРіРѕ РєРѕРјРјРёС‚Р°:
```bash
git checkout -b feature/sprintN-slug
```

> Claude РЅРµ РїРµСЂРµРєР»СЋС‡Р°РµС‚ РІРµС‚РєСѓ СЃР°Рј вЂ” РѕРЅ РїРёС€РµС‚ РєРѕРјР°РЅРґСѓ, РєРѕС‚РѕСЂСѓСЋ РІС‹РїРѕР»РЅСЏРµС‚ СЂР°Р·СЂР°Р±РѕС‚С‡РёРє.

---

### РџСЂР°РІРёР»Рѕ СЃР»РёСЏРЅРёСЏ РІ main

РЎР»РёСЏРЅРёРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ **С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё Р±РёР»РґР°** РЅР° СѓСЃС‚СЂРѕР№СЃС‚РІРµ/СЌРјСѓР»СЏС‚РѕСЂРµ. РџСЂР°РІРёР»Р°:

1. **Squash-merge** вЂ” РѕРґРЅР° РІРµС‚РєР° = РѕРґРёРЅ РёР»Рё РЅРµСЃРєРѕР»СЊРєРѕ РѕСЃРјС‹СЃР»РµРЅРЅС‹С… РєРѕРјРјРёС‚РѕРІ, РЅРµ В«WIPВ».
2. Р¤РѕСЂРјР°С‚ СЃРѕРѕР±С‰РµРЅРёСЏ РєРѕРјРјРёС‚Р°: `feat(sprintN): РєСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ` / `fix(СЌРєСЂР°РЅ): С‡С‚Рѕ РёСЃРїСЂР°РІР»РµРЅРѕ`
3. РџРµСЂРµРґ merge СѓР±РµРґРёС‚СЊСЃСЏ, С‡С‚Рѕ `summary.md` РѕР±РЅРѕРІР»С‘РЅ (Р·Р°РґР°С‡Р° РѕС‚РјРµС‡РµРЅР° `[x]`).
4. РџРѕСЃР»Рµ merge вЂ” СѓРґР°Р»РёС‚СЊ РІРµС‚РєСѓ Р»РѕРєР°Р»СЊРЅРѕ Рё РЅР° remote:

```bash
# РќР° СѓСЃС‚СЂРѕР№СЃС‚РІРµ/СЌРјСѓР»СЏС‚РѕСЂРµ Р±РёР»Рґ РїСЂРѕС€С‘Р»
git checkout main
git merge --squash feature/sprintN-slug
git commit -m "feat(sprintN): РѕРїРёСЃР°РЅРёРµ РІСЃРµРіРѕ С‡С‚Рѕ СЃРґРµР»Р°РЅРѕ РІ РІРµС‚РєРµ"
git push origin main
git branch -d feature/sprintN-slug
git push origin --delete feature/sprintN-slug
```

5. **РќРёРєРѕРіРґР° РЅРµ РјРµСЂР¶РёС‚СЊ** РµСЃР»Рё:
   - Р±РёР»Рґ РЅРµ СЃРѕР±РёСЂР°РµС‚СЃСЏ (РѕС€РёР±РєРё РєРѕРјРїРёР»СЏС‚РѕСЂР°)
   - РІ `summary.md` Р·Р°РґР°С‡Р° РµС‰С‘ РІ СЃС‚Р°С‚СѓСЃРµ `[ ]`

---

## 1. РљР°СЃС‚РѕРјРЅС‹Р№ Result

Р’ РїСЂРѕРµРєС‚Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ **СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№** `sealed class Result`, РѕР±СЉСЏРІР»РµРЅРЅС‹Р№ РІ `TodayRepository.kt`:

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
```

### РќРµР»СЊР·СЏ
```kotlin
// kotlin.Result + runCatching вЂ” РЅРµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ
suspend fun getCrops(): kotlin.Result<List<Crop>> = runCatching { api.getCrops() }
result.fold(onSuccess = { ... }, onFailure = { ... })
```

### РџСЂР°РІРёР»СЊРЅРѕ вЂ” Repository
```kotlin
suspend fun getCrops(): Result<List<Crop>> = try {
    Result.Success(api.getCrops())
} catch (e: Exception) {
    Result.Error(e.message ?: "РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё")
}
```

### РџСЂР°РІРёР»СЊРЅРѕ вЂ” ViewModel
```kotlin
when (val result = repository.getCrops()) {
    is Result.Success -> { /* result.data */ }
    is Result.Error   -> { /* result.message */ }
    is Result.Loading -> Unit
}
```

---

## 2. РџРѕР»СѓС‡РµРЅРёРµ gardenId

РўРµРєСѓС‰РёР№ СЃР°Рґ С…СЂР°РЅРёС‚СЃСЏ РІ `TokenStorage`. РќРµ РЅСѓР¶РЅРѕ РІС‹Р·С‹РІР°С‚СЊ API вЂ” РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ:

```kotlin
val gardenId = tokenStorage.getGardenId()   // -1 РµСЃР»Рё РЅРµ РІС‹Р±СЂР°РЅ
if (gardenId == -1) return Result.Error("РЈС‡Р°СЃС‚РѕРє РЅРµ РІС‹Р±СЂР°РЅ")
```

**РњРµС‚РѕРґС‹ TokenStorage:**
| РњРµС‚РѕРґ | РћРїРёСЃР°РЅРёРµ |
|---|---|
| `getToken(): String?` | JWT С‚РѕРєРµРЅ, null РµСЃР»Рё РЅРµ Р·Р°Р»РѕРіРёРЅРµРЅ |
| `getGardenId(): Int` | ID С‚РµРєСѓС‰РµРіРѕ СЃР°РґР°, -1 РµСЃР»Рё РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ |
| `hasGarden(): Boolean` | true РµСЃР»Рё СЃР°Рґ СѓР¶Рµ СЃРѕР·РґР°РЅ |
| `saveToken(token)` | РЎРѕС…СЂР°РЅРёС‚СЊ С‚РѕРєРµРЅ РїРѕСЃР»Рµ Р»РѕРіРёРЅР° |
| `saveGardenId(id)` | РЎРѕС…СЂР°РЅРёС‚СЊ ID СЃР°РґР° РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ |
| `clearToken()` | Р’С‹С…РѕРґ РёР· Р°РєРєР°СѓРЅС‚Р° |
| `saveClimateZone(zone?)` | РЎРѕС…СЂР°РЅРёС‚СЊ РєР»РёРјР°С‚РёС‡РµСЃРєСѓСЋ Р·РѕРЅСѓ СѓС‡Р°СЃС‚РєР° |
| `getClimateZone(): String?` | РџРѕР»СѓС‡РёС‚СЊ РєР»РёРјР°С‚РёС‡РµСЃРєСѓСЋ Р·РѕРЅСѓ ("3"вЂ“"6") |

---

## 3. РњРµС‚РѕРґС‹ СЂРµРїРѕР·РёС‚РѕСЂРёРµРІ

РџРµСЂРµРґ РІС‹Р·РѕРІРѕРј РјРµС‚РѕРґР° СЂРµРїРѕР·РёС‚РѕСЂРёСЏ вЂ” РїСЂРѕРІРµСЂРёС‚СЊ СЃРёРіРЅР°С‚СѓСЂСѓ РІ С„Р°Р№Р»Рµ.

| Р РµРїРѕР·РёС‚РѕСЂРёР№ | РњРµС‚РѕРґ | Р’РѕР·РІСЂР°С‰Р°РµС‚ |
|---|---|---|
| `TodayRepository` | `getToday()` | `Result<TodayResponse>` |
| `AuthRepository` | `login(email, password)` | `Result<UserProfile>` |
| `AuthRepository` | `register(name, email, password)` | `Result<UserProfile>` |
| `GardenRepository` | `loadGardens()` | `Result<List<Garden>>` |
| `GardenRepository` | `createGarden(name, region, city?)` | `Result<Garden>` |
| `GardenRepository` | `hasGarden()` | `Boolean` |
| `CropsRepository` | `getCrops(category?)` | `Result<List<Crop>>` |
| `CropsRepository` | `getCrop(id)` | `Result<Crop>` |
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

---

## 4. РЎС‚СЂСѓРєС‚СѓСЂР° ViewModel

```kotlin
@HiltViewModel
class XxxViewModel @Inject constructor(
    private val repository: XxxRepository,
    private val tokenStorage: TokenStorage   // РµСЃР»Рё РЅСѓР¶РµРЅ gardenId
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

UiState вЂ” **data class СЃ РґРµС„РѕР»С‚Р°РјРё** (РЅРµ sealed class), РµСЃР»Рё РЅР° СЌРєСЂР°РЅРµ РѕРґРёРЅ РѕСЃРЅРѕРІРЅРѕР№ РєРѕРЅС‚РµРЅС‚:
```kotlin
data class XxxUiState(
    val items: List<Xxx> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)
```

Sealed UiState РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РєРѕРіРґР° СЌРєСЂР°РЅ РёРјРµРµС‚ РїСЂРёРЅС†РёРїРёР°Р»СЊРЅРѕ СЂР°Р·РЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ (СЃРј. `TodayUiState`).

---

## 5. РЎРІРµСЂРєР° РјРѕРґРµР»РµР№ СЃ Р±СЌРєРµРЅРґРѕРј вЂ” РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ

РџРµСЂРµРґ РЅР°РїРёСЃР°РЅРёРµРј РёР»Рё РёР·РјРµРЅРµРЅРёРµРј Р»СЋР±РѕР№ `data class` РјРѕРґРµР»Рё (Models.kt) вЂ” РѕС‚РєСЂС‹С‚СЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёР№ СЂРѕСѓС‚ РІ `backend/src/routes/` Рё СЃРІРµСЂРёС‚СЊ **РёРјРµРЅР° РїРѕР»РµР№**.

РџСЂР°РІРёР»Рѕ: JSON-РёРјСЏ РїРѕР»СЏ = РёРјСЏ СЃС‚РѕР»Р±С†Р° РІ Р‘Р” = С‚Рѕ, С‡С‚Рѕ РІРѕР·РІСЂР°С‰Р°РµС‚ `RETURNING *` РёР»Рё `SELECT`.

Р§Р°СЃС‚С‹Рµ РѕС€РёР±РєРё:
- РљРѕР»РѕРЅРєР° `action_type` в†’ РЅСѓР¶РµРЅ `@Json(name = "action_type")`, Р° РЅРµ РїСЂРѕСЃС‚Рѕ `val type`
- РљРѕР»РѕРЅРєР° `planted_at` в†’ РЅСѓР¶РµРЅ `@Json(name = "planted_at")`, Р° РЅРµ `sown_at`
- РџРѕР»СЏ РєРѕС‚РѕСЂС‹С… РЅРµС‚ РІ Р‘Р” (`location`, `title`) вЂ” РЅРµ РґРѕР±Р°РІР»СЏС‚СЊ РєР°Рє non-nullable
- РРјСЏ С‚Р°Р±Р»РёС†С‹ РІ SQL-Р·Р°РїСЂРѕСЃР°С…: `action_logs` (РЅРµ `actions`)

**Р§РµРєР»РёСЃС‚ РїРµСЂРµРґ РєРѕРјРјРёС‚РѕРј РјРѕРґРµР»Рё:**
```
[ ] РћС‚РєСЂС‹Р» СЂРѕСѓС‚ Р±СЌРєРµРЅРґР° Рё РЅР°С€С‘Р» С‡С‚Рѕ СЂРµР°Р»СЊРЅРѕ РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ (RETURNING * РёР»Рё SELECT РїРѕР»СЏ)
[ ] Р’СЃРµ snake_case РїРѕР»СЏ РїРѕРєСЂС‹С‚С‹ @Json(name = "...")
[ ] Non-nullable РїРѕР»СЏ (Р±РµР· ?) С‚РѕС‡РЅРѕ РїСЂРёСЃСѓС‚СЃС‚РІСѓСЋС‚ РІ РѕС‚РІРµС‚Рµ Р±СЌРєРµРЅРґР°
[ ] РќРµС‚ РїРѕР»РµР№ РєРѕС‚РѕСЂС‹С… РЅРµС‚ РІ СЃС…РµРјРµ Р‘Р”
[ ] РРјРµРЅР° С‚Р°Р±Р»РёС† РІ SQL РїСЂРѕРІРµСЂРµРЅС‹ РїРѕ 001_init.sql
```

---


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
| `reminders` | `type` | строка из Android (произвольная) |

> **Источник истины**: `ACTION_TYPES` в `ActionLogViewModel.kt`, `STAGE_ORDER` в `PlantingsScreen.kt`.

**Чеклист при написании SQL-запроса с WHERE по enum-полю:**
```
[ ] Открыл Android-код и нашёл где это поле заполняется (ViewModel / Repository)
[ ] Строковое значение в SQL совпадает с тем, что пишет Android
[ ] Если значение не очевидно — добавил его в таблицу выше
```

**Как нашли баг**: `today.js` и `recommendations.js` запрашивали `action_type = 'watered'`, тогда как Android пишет `'watering'`. Из-за этого `lastWateredMap` всегда был пуст → рекомендации ложно показывали полив для только что политых растений.
## 6. Moshi JSON Р°РЅРЅРѕС‚Р°С†РёРё (Kotlin 2.3+ / AGP 9+)

**Р’Р°Р¶РЅРѕ:** СЃ Kotlin 2.3+ Рё AGP 9.0 РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ `@Json` **Р±РµР·** `@field:` РїСЂРµС„РёРєСЃР°.

### РќРµР»СЊР·СЏ (Kotlin 2.3+ РЅРµ РїСЂРёРјРµРЅСЏРµС‚ Рє РїРѕР»СЋ)
```kotlin
@field:Json(name = "garden_id") val gardenId: Int
```

### РџСЂР°РІРёР»СЊРЅРѕ
```kotlin
@Json(name = "garden_id") val gardenId: Int
```

РџСЂРёС‡РёРЅР°: С„Р»Р°Рі `-Xannotation-default-target=param-property` Р±С‹Р» СѓРґР°Р»С‘РЅ РІ Kotlin 2.3+. Р‘РµР· РЅРµРіРѕ `@field:Json` РЅРµ РїРѕРґС…РІР°С‚С‹РІР°РµС‚СЃСЏ Moshi KSP РїСЂРё РіРµРЅРµСЂР°С†РёРё Р°РґР°РїС‚РµСЂРѕРІ. `@Json` Р±РµР· site-target РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє РїР°СЂР°РјРµС‚СЂСѓ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР° вЂ” РёРјРµРЅРЅРѕ С‚Р°Рј Moshi KSP РµРіРѕ Рё РёС‰РµС‚.

---

## 7. Р РµРїРѕР·РёС‚РѕСЂРёРё (РЎРїСЂРёРЅС‚С‹ 4вЂ“5)

| Р РµРїРѕР·РёС‚РѕСЂРёР№ | РњРµС‚РѕРґ | Р’РѕР·РІСЂР°С‰Р°РµС‚ |
|---|---|---|
| `WeatherRepository` | `getWeather()` | `Result<WeatherSnapshot>` |
| `RecommendationsRepository` | `getRecommendations()` | `Result<List<Recommendation>>` |
| `HarvestRepository` | `getHarvests(gardenId?)` | `Result<List<Harvest>>` |
| `HarvestRepository` | `addHarvest(plantingId, weightKg?, quantity?, notes?)` | `Result<Harvest>` |
| `AnalyticsRepository` | `getSummary()` | `Result<AnalyticsSummary>` |
| `AnalyticsRepository` | `exportActionsIntent()` | `Result<Intent>` (Share chooser) |

`AnalyticsRepository` С‚СЂРµР±СѓРµС‚ `@ApplicationContext` вЂ” РёСЃРїРѕР»СЊР·СѓРµС‚ `FileProvider` РґР»СЏ CSV-СЌРєСЃРїРѕСЂС‚Р°.

---

## 8. DI вЂ” РїСЂР°РІРёР»Р°

- Р’СЃРµ СЂРµРїРѕР·РёС‚РѕСЂРёРё вЂ” `@Singleton` + `@Inject constructor`
- ViewModels вЂ” `@HiltViewModel` + `@Inject constructor`
- `Context` РІ РЅРµ-Android РєР»Р°СЃСЃР°С… РїРѕР»СѓС‡Р°С‚СЊ С‡РµСЂРµР· `@ApplicationContext` (СЃРј. `TokenStorage`, `ReminderScheduler`)
- WorkManager Workers вЂ” С‡РµСЂРµР· `@HiltWorker` + `@AssistedInject`

---

## 9. РќР°РІРёРіР°С†РёСЏ

РњР°СЂС€СЂСѓС‚С‹ РѕР±СЉСЏРІР»РµРЅС‹ РІ `Navigation.kt` РєР°Рє `sealed class Screen(val route: String)`.
BottomBar СЃРєСЂС‹РІР°РµС‚СЃСЏ РЅР° СЌРєСЂР°РЅР°С… РёР· `screensWithoutBottomBar`.

РџРµСЂРµС…РѕРґ СЃ РїР°СЂР°РјРµС‚СЂРѕРј:
```kotlin
// РћР±СЉСЏРІР»РµРЅРёРµ
object CropDetail : Screen("crop_detail/{cropId}") {
    fun route(cropId: Int) = "crop_detail/$cropId"
}
// Р’С‹Р·РѕРІ
navController.navigate(Screen.CropDetail.route(crop.id))
```

---

## 10. РЎС‚Р°РґРёРё РїРѕСЃР°РґРєРё

РџРѕСЂСЏРґРѕРє: `sowing в†’ sprouted в†’ growing в†’ flowering в†’ harvesting в†’ done`

РћРїСЂРµРґРµР»РµРЅС‹ РІ `PlantingsScreen.kt`:
```kotlin
val STAGE_ORDER = listOf("sowing", "sprouted", "growing", "flowering", "harvesting", "done")
val STAGE_LABELS = mapOf("sowing" to "РџРѕСЃРµСЏРЅРѕ", ...)
```

---


---

## 11. Р”РµРїР»РѕР№ РЅР° VPS вЂ” РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє

**РќРµР»СЊР·СЏ РґРµР»Р°С‚СЊ `git pull` РЅР° VPS Р±РµР· РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅРѕРіРѕ РєРѕРјРјРёС‚Р° Рё РїСѓС€Р° Р»РѕРєР°Р»СЊРЅРѕ.**

РџРѕСЂСЏРґРѕРє РІСЃРµРіРґР° С‚Р°РєРѕР№:

```bash
# 1. Р›РћРљРђР›Р¬РќРћ вЂ” СЃРЅР°С‡Р°Р»Р° РєРѕРјРјРёС‚ Рё РїСѓС€
git add -A
git commit -m "feat/fix: РѕРїРёСЃР°РЅРёРµ"
git push origin <branch>

# 2. РўРћР›Р¬РљРћ РџРћРўРћРњ вЂ” РЅР° VPS
cd /var/www/dacha-api/backend
git stash          # РµСЃР»Рё РµСЃС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Рµ РїСЂР°РІРєРё РЅР° VPS
git pull origin <branch>
npm run migrate    # РµСЃР»Рё Р±С‹Р»Рё РЅРѕРІС‹Рµ РјРёРіСЂР°С†РёРё
pm2 restart dacha-api
```

> Р•СЃР»Рё РїСЂРѕРїСѓСЃС‚РёС‚СЊ С€Р°Рі 1 вЂ” `git pull` РЅРµ РїСЂРёРЅРµСЃС‘С‚ РЅРѕРІС‹Р№ РєРѕРґ, Рё РґРµРїР»РѕР№ Р±РµСЃСЃРјС‹СЃР»РµРЅРµРЅ.

## РСЃС‚РѕСЂРёСЏ РёР·РјРµРЅРµРЅРёР№

| Р”Р°С‚Р° | РЎРїСЂРёРЅС‚ | Р§С‚Рѕ РґРѕР±Р°РІР»РµРЅРѕ |
|---|---|---|
| 2026-05-28 | Sprint 3 | РЎРѕР·РґР°РЅ С„Р°Р№Р». Р”РѕР±Р°РІР»РµРЅС‹ РїР°С‚С‚РµСЂРЅС‹ Result, TokenStorage, РјРµС‚РѕРґС‹ РІСЃРµС… СЂРµРїРѕР·РёС‚РѕСЂРёРµРІ, СЃС‚СЂСѓРєС‚СѓСЂР° ViewModel, РЅР°РІРёРіР°С†РёСЏ, СЃС‚Р°РґРёРё РїРѕСЃР°РґРєРё |
| 2026-05-29 | Sprint 4 | Р”РѕР±Р°РІР»РµРЅС‹ WeatherRepository, RecommendationsRepository |
| 2026-05-29 | Sprint 5 | Git-РїСЂР°РІРёР»Р° (СЂР°Р·РґРµР» 0): РёРјРµРЅРѕРІР°РЅРёРµ РІРµС‚РѕРє, squash-merge РІ main. HarvestRepository |
| 2026-05-30 | Sprint 5 | AnalyticsRepository (getSummary, exportActionsIntent), AnalyticsScreen + AnalyticsViewModel, FileProvider РґР»СЏ CSV-СЌРєСЃРїРѕСЂС‚Р°, РјР°СЂС€СЂСѓС‚ Screen.Analytics РІ BottomNav |
| 2026-05-30 | Bugs | Р”РѕР±Р°РІР»РµРЅ СЂР°Р·РґРµР» 5 В«РЎРІРµСЂРєР° РјРѕРґРµР»РµР№ СЃ Р±СЌРєРµРЅРґРѕРјВ» вЂ” С‡РµРєР»РёСЃС‚ РїРѕСЃР»Рµ СЃРµСЂРёРё Р±Р°РіРѕРІ СЃ РЅРµСЃРѕРІРїР°РґРµРЅРёРµРј РёРјС‘РЅ РїРѕР»РµР№ (action_type, planted_at, Reminder.title, Garden.location) |
| 2026-05-31 | KB v2 | Crop СЂР°СЃС€РёСЂРµРЅ: ClimateZoneWindow, WateringStage, FertilizingEntry, CropDisease, CropPest. РќРѕРІС‹Рµ РїРѕР»СЏ climate_zones, watering_details, fertilizing_schedule, diseases, pests, good/bad_neighbors, good_predecessors вЂ” РІСЃРµ nullable СЃ РґРµС„РѕР»С‚РѕРј null. |
| 2026-05-31 | Post-MVP | TokenStorage: +saveClimateZone/getClimateZone/hasGarden. PlantingsRepository: +updateInfo, +deletePlanting. Planting: +quantity, conditions, lastActionAt. РќРѕРІС‹Р№ UpdatePlantingInfoRequest. РўР°Р±Р»РёС†Р° action_logs (РЅРµ actions). |
| 2026-05-31 | Post-MVP | РќРѕРІС‹Р№ CareTask (Models.kt), care_tasks РІ Crop. PlantingInfoViewModel (Р·Р°РіСЂСѓР¶Р°РµС‚ Crop + Actions). PlantingInfoBottomSheet: РґР°С‚Р°/СѓСЃР»РѕРІРёСЏ/РєРѕР»-РІРѕ, СЂР°СЃРїРёСЃР°РЅРёРµ СЂР°Р±РѕС‚ СЃ РґР°С‚Р°РјРё, РїРѕСЃР»РµРґРЅРёРµ 5 РґРµР№СЃС‚РІРёР№, РєРЅРѕРїРєР° Рћ РєСѓР»СЊС‚СѓСЂРµ. ActionLogViewModel.reset() вЂ” С„РёРєСЃ РїРѕРІС‚РѕСЂРЅРѕРіРѕ РѕС‚РєСЂС‹С‚РёСЏ С€С‚РѕСЂРєРё. |


