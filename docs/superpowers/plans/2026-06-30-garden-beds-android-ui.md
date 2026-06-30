# Грядки участка + севооборот — Android UI: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: используйте superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans для пошаговой реализации. Шаги помечены чекбоксами (`- [ ]`).

**Goal:** Добавить в Android-приложение «Календарь дачника» поле «Место» (грядка) в формы создания и редактирования посадки и на экран деталей, с инлайн-управлением грядками и мягкой подсказкой о севообороте — зеркально вебу (спека `docs/archive/superpowers/specs/2026-06-27-garden-beds-rotation-design.md`, раздел 3).

**Architecture:** Бэкенд уже задеплоен и проверен (эндпоинты грядок, `bed_id`, `crops.family`, миграции 052/053 + GRANT 055). Это чисто клиентская работа: Moshi-модели → Retrofit `DachaApi` + новый `BedsRepository` → переиспользуемый Compose-компонент `BedPickerField` (+ чистая функция `rotationWarning`) → подключение в `PlantingSetupBottomSheet`/`PlantingEditBottomSheet` (через `PlantingsViewModel`) и `PlantingInfoScreen` (через `PlantingInfoViewModel`). Подсказка севооборота считается на клиенте: история грядки за 3 года приходит встроенной в `GET /gardens/:id/beds`.

**Tech Stack:** Kotlin, Jetpack Compose (Material3), Hilt, Retrofit + Moshi (codegen-адаптеры), Coroutines; тесты — JUnit4 + MockK + kotlinx-coroutines-test. UI-автотестов экранов в проекте нет — проверка сборкой + вручную (как для прочих UI-фич, спека §5). Чистую функцию `rotationWarning` покрываем юнит-тестом (TDD).

**Контракт API (подтверждён вживую на проде):**
- `GET /gardens/:id/beds` → `[{ id, name, type, history: [{ crop_name, family, year }] }]` (в списке `garden_id` НЕ приходит; история — посадки за 3 года).
- `POST /gardens/:id/beds` `{ name, type }` → полный объект грядки (с `garden_id`, `history: []`).
- `PATCH /beds/:id` `{ name?, type? }` → полный объект грядки.
- `DELETE /beds/:id` → `{ deleted: true }`.
- `POST /plantings` и `PATCH /plantings/:id/info` принимают опциональный `bed_id`.
- **Ограничение бэкенда (унаследовано):** `PATCH /plantings/:id/info` использует `bed_id = COALESCE($8, bed_id)` — передача отсутствующего/`null` `bed_id` НЕ сбрасывает грядку (снять привязку через этот эндпоинт нельзя; отвязка только при удалении грядки, `ON DELETE SET NULL`). Поэтому пункт «Не выбрано» в пикере при редактировании существующей посадки — не отправляем как очистку (см. Task 5, шаг 3).

---

## Структура файлов

| Файл | Ответственность | Действие |
|------|------|------|
| `android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt` | Moshi-модели | Modify: +`GardenBed`, +`BedHistoryEntry`, +`CreateBedRequest`, +`UpdateBedRequest`; +`bedId` в `Planting`/`CreatePlantingRequest`/`UpdatePlantingInfoRequest`; +`family` в `Crop` |
| `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt` | Retrofit-интерфейс | Modify: +4 эндпоинта грядок |
| `android/app/src/main/java/ru/dachakalend/app/data/repository/BedsRepository.kt` | CRUD грядок | Create |
| `android/app/src/main/java/ru/dachakalend/app/ui/plantings/BedPickerField.kt` | Переиспользуемый пикер грядки + `rotationWarning` | Create |
| `android/app/src/test/java/ru/dachakalend/app/plantings/RotationWarningTest.kt` | Юнит-тест чистой функции | Create |
| `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsViewModel.kt` | Состояние грядок + проброс `bedId` | Modify |
| `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsScreen.kt` | Пикер в обеих шторках | Modify |
| `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoViewModel.kt` | Грядки + правка «Места» | Modify |
| `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoScreen.kt` | Строка/правка «Места» + подсказка | Modify |

> Все пути ниже — относительно корня репозитория. Команды сборки запускать из `android/`.

---

### Task 1: Модели данных (Moshi)

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt`

- [ ] **Step 1: Добавить модели грядки**

В `Models.kt` после блока `// --- Garden ---` (после `data class UpdateGardenRequest(...)`, в конце файла) добавить:

```kotlin
// --- Garden beds (грядки) ---

@JsonClass(generateAdapter = true)
data class BedHistoryEntry(
    @Json(name = "crop_name") val cropName: String,
    val family: String? = null,
    val year: Int
)

@JsonClass(generateAdapter = true)
data class GardenBed(
    val id: Int,
    // В списке GET /gardens/:id/beds сервер garden_id не отдаёт — поле nullable.
    @Json(name = "garden_id") val gardenId: Int? = null,
    val name: String,
    val type: String,                       // "soil" | "greenhouse"
    val history: List<BedHistoryEntry> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CreateBedRequest(
    val name: String,
    val type: String                        // "soil" | "greenhouse"
)

@JsonClass(generateAdapter = true)
data class UpdateBedRequest(
    val name: String? = null,
    val type: String? = null
)
```

- [ ] **Step 2: Добавить `bedId` в `Planting`**

В `data class Planting(...)` после строки `val variety: String? = null,` добавить:

```kotlin
    @Json(name = "bed_id") val bedId: Int? = null,
```

- [ ] **Step 3: Добавить `family` в `Crop`**

В `data class Crop(...)` после строки `val category: String,` добавить:

```kotlin
    val family: String? = null,
```

- [ ] **Step 4: Добавить `bedId` в запросы посадки**

В `data class CreatePlantingRequest(...)` после `val variety: String? = null` добавить (через запятую):

```kotlin
    ,
    @Json(name = "bed_id") val bedId: Int? = null
```

В `data class UpdatePlantingInfoRequest(...)` после `val variety: String? = null` добавить (через запятую):

```kotlin
    ,
    @Json(name = "bed_id") val bedId: Int? = null
```

- [ ] **Step 5: Скомпилировать**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL (Moshi codegen генерит адаптеры для новых `@JsonClass`).

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt
git commit -m "feat(android): модели GardenBed/BedHistoryEntry + bed_id/family"
```

---

### Task 2: API-эндпоинты грядок + репозиторий

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt`
- Create: `android/app/src/main/java/ru/dachakalend/app/data/repository/BedsRepository.kt`

- [ ] **Step 1: Добавить эндпоинты в `DachaApi`**

В `DachaApi.kt` сразу после блока `// Gardens` (после метода `updateGarden(...)`) добавить:

```kotlin
    // Garden beds (грядки)
    @GET("gardens/{id}/beds")
    suspend fun getBeds(@Path("id") gardenId: Int): List<GardenBed>

    @POST("gardens/{id}/beds")
    suspend fun createBed(@Path("id") gardenId: Int, @Body request: CreateBedRequest): GardenBed

    @PATCH("beds/{id}")
    suspend fun updateBed(@Path("id") id: Int, @Body request: UpdateBedRequest): GardenBed

    @HTTP(method = "DELETE", path = "beds/{id}", hasBody = false)
    suspend fun deleteBed(@Path("id") id: Int)
```

(Модели уже импортированы строкой `import ru.dachakalend.app.data.model.*` в начале файла — отдельных импортов не нужно.)

- [ ] **Step 2: Создать `BedsRepository`**

Создать `android/app/src/main/java/ru/dachakalend/app/data/repository/BedsRepository.kt` (паттерн скопирован с `PlantingsRepository`):

```kotlin
package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreateBedRequest
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.model.UpdateBedRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BedsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getBeds(gardenId: Int): Result<List<GardenBed>> = try {
        Result.Success(api.getBeds(gardenId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки грядок")
    }

    suspend fun createBed(gardenId: Int, name: String, type: String): Result<GardenBed> = try {
        Result.Success(api.createBed(gardenId, CreateBedRequest(name = name, type = type)))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка создания грядки")
    }

    suspend fun updateBed(id: Int, name: String? = null, type: String? = null): Result<GardenBed> = try {
        Result.Success(api.updateBed(id, UpdateBedRequest(name = name, type = type)))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка переименования грядки")
    }

    suspend fun deleteBed(id: Int): Result<Unit> = try {
        api.deleteBed(id)
        Result.Success(Unit)
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка удаления грядки")
    }
}
```

(DI: `BedsRepository` помечен `@Singleton` с `@Inject constructor`, как `PlantingsRepository`/`GardenRepository` — Hilt создаёт его автоматически, ручной биндинг в модулях не нужен. `Result` — `ru.dachakalend.app.data.repository.Result`, тот же sealed-тип, что у других репозиториев.)

- [ ] **Step 3: Скомпилировать**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt \
        android/app/src/main/java/ru/dachakalend/app/data/repository/BedsRepository.kt
git commit -m "feat(android): API грядок + BedsRepository"
```

---

### Task 3: Компонент `BedPickerField` + чистая функция `rotationWarning` (TDD)

**Files:**
- Create: `android/app/src/test/java/ru/dachakalend/app/plantings/RotationWarningTest.kt`
- Create: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/BedPickerField.kt`

- [ ] **Step 1: Написать падающий юнит-тест на `rotationWarning`**

Создать `android/app/src/test/java/ru/dachakalend/app/plantings/RotationWarningTest.kt`:

```kotlin
package ru.dachakalend.app.plantings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.BedHistoryEntry
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.plantings.rotationWarning

class RotationWarningTest {

    private fun bed(name: String, history: List<BedHistoryEntry>) =
        GardenBed(id = 1, gardenId = 12, name = name, type = "greenhouse", history = history)

    @Test
    fun `нет грядки или нет семейства — нет предупреждения`() {
        assertNull(rotationWarning(null, "Паслёновые"))
        assertNull(rotationWarning(bed("Грядка", emptyList()), null))
    }

    @Test
    fun `семейство не совпадает с историей — нет предупреждения`() {
        val b = bed("Грядка 1", listOf(BedHistoryEntry("Огурец", "Тыквенные", 2025)))
        assertNull(rotationWarning(b, "Паслёновые"))
    }

    @Test
    fun `совпадение семейства — предупреждение с самым свежим годом и культурой`() {
        val b = bed(
            "Теплица 1",
            listOf(
                BedHistoryEntry("Баклажан", "Паслёновые", 2024),
                BedHistoryEntry("Томат", "Паслёновые", 2025)
            )
        )
        assertEquals(
            "На грядке «Теплица 1» в 2025 росла культура семейства «Паслёновые» (Томат) — " +
                "для этого семейства рекомендуют перерыв 3–4 года.",
            rotationWarning(b, "Паслёновые")
        )
    }
}
```

- [ ] **Step 2: Запустить тест — убедиться, что не компилируется/падает**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "ru.dachakalend.app.plantings.RotationWarningTest"`
Expected: FAIL — `rotationWarning` ещё не определена (unresolved reference).

- [ ] **Step 3: Реализовать `BedPickerField.kt` (компонент + чистая функция)**

Создать `android/app/src/main/java/ru/dachakalend/app/ui/plantings/BedPickerField.kt`. Грядка — просто именованное место (без визуальной карты, см. дизайн). Пикер: текущее значение + выпадающее меню со списком грядок, пунктом «Не выбрано», иконками переименовать/удалить у строки и кнопкой «+ Новая грядка» (название + чипы Грунт/Теплица). Под полем — мягкое предупреждение о севообороте.

```kotlin
package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Подсказка севооборота: совпало ли семейство выбранной культуры с семейством в истории
 * грядки за 3 года (история приходит вместе с грядкой). Возвращает текст предупреждения или null.
 * Чистая функция — покрыта юнит-тестом (RotationWarningTest).
 */
fun rotationWarning(bed: GardenBed?, cropFamily: String?): String? {
    if (bed == null || cropFamily.isNullOrBlank()) return null
    val match = bed.history
        .filter { it.family == cropFamily }
        .maxByOrNull { it.year } ?: return null
    return "На грядке «${bed.name}» в ${match.year} росла культура семейства " +
        "«$cropFamily» (${match.cropName}) — для этого семейства рекомендуют перерыв 3–4 года."
}

/**
 * Поле выбора грядки с инлайн-созданием/переименованием/удалением.
 * Состояние списка грядок и CRUD-операции владеет вызывающий экран/VM — компонент только UI.
 *
 * @param beds список грядок участка (с историей)
 * @param selectedBedId текущая выбранная грядка (null = «Не выбрано»)
 * @param cropFamily семейство выбранной культуры — для подсказки севооборота (null = не показывать)
 * @param allowClear показывать ли пункт «Не выбрано» (false при правке существующей посадки —
 *        бэкенд не умеет снимать привязку через PATCH info, см. шапку плана)
 * @param onSelect выбрана грядка (или null при очистке)
 * @param onCreate создать грядку (name, type) — VM добавит в список и вызовет onSelect
 * @param onRename переименовать грядку
 * @param onDelete удалить грядку
 */
@Composable
fun BedPickerField(
    beds: List<GardenBed>,
    selectedBedId: Int?,
    cropFamily: String?,
    allowClear: Boolean,
    onSelect: (GardenBed?) -> Unit,
    onCreate: (name: String, type: String) -> Unit,
    onRename: (bed: GardenBed, name: String) -> Unit,
    onDelete: (bed: GardenBed) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newType by remember { mutableStateOf("soil") }
    var renamingId by remember { mutableStateOf<Int?>(null) }
    var renameValue by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf<GardenBed?>(null) }

    val selectedBed = beds.firstOrNull { it.id == selectedBedId }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "Место (необязательно)",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onBackground
        )

        Box {
            OutlinedButton(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    selectedBed?.let { b ->
                        b.name + (if (b.type == "greenhouse") " · теплица" else " · грунт")
                    } ?: "Не выбрано",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                Icon(Icons.Default.ArrowDropDown, contentDescription = null)
            }

            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                if (allowClear) {
                    DropdownMenuItem(
                        text = { Text("Не выбрано", fontFamily = NunitoFamily) },
                        onClick = { expanded = false; onSelect(null) }
                    )
                }
                beds.forEach { bed ->
                    if (renamingId == bed.id) {
                        OutlinedTextField(
                            value = renameValue,
                            onValueChange = { renameValue = it },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                            trailingIcon = {
                                TextButton(onClick = {
                                    val n = renameValue.trim()
                                    renamingId = null
                                    if (n.isNotEmpty() && n != bed.name) onRename(bed, n)
                                }) { Text("OK", fontFamily = NunitoFamily) }
                            }
                        )
                    } else {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    bed.name + (if (bed.type == "greenhouse") " · теплица" else " · грунт"),
                                    fontFamily = NunitoFamily,
                                    fontWeight = if (bed.id == selectedBedId) FontWeight.Black else FontWeight.Normal
                                )
                            },
                            onClick = { expanded = false; onSelect(bed) },
                            trailingIcon = {
                                Row {
                                    IconButton(onClick = { renamingId = bed.id; renameValue = bed.name }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Edit, contentDescription = "Переименовать", modifier = Modifier.size(16.dp))
                                    }
                                    IconButton(onClick = { confirmDelete = bed }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Delete, contentDescription = "Удалить", modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        )
                    }
                }

                HorizontalDivider()

                if (creating) {
                    Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = newName,
                            onValueChange = { if (it.length <= 80) newName = it },
                            label = { Text("Название грядки", fontFamily = NunitoFamily) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions.Default,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = newType == "soil",
                                onClick = { newType = "soil" },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = { Text("Грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                            )
                            FilterChip(
                                selected = newType == "greenhouse",
                                onClick = { newType = "greenhouse" },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = { Text("Теплица", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { creating = false; newName = ""; newType = "soil" }) {
                                Text("Отмена", fontFamily = NunitoFamily)
                            }
                            Button(onClick = {
                                val n = newName.trim()
                                if (n.isNotEmpty()) {
                                    onCreate(n, newType)
                                    creating = false; newName = ""; newType = "soil"; expanded = false
                                }
                            }) { Text("Добавить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold) }
                        }
                    }
                } else {
                    DropdownMenuItem(
                        text = { Text("Новая грядка", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                        leadingIcon = { Icon(Icons.Default.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                        onClick = { creating = true }
                    )
                }
            }
        }

        rotationWarning(selectedBed, cropFamily)?.let { warn ->
            Text(
                warn,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.tertiary
            )
        }
    }

    confirmDelete?.let { bed ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("Удалить грядку?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = { Text("«${bed.name}» будет удалена. Посадки на ней не пропадут — у них просто снимется привязка к месту.", fontFamily = NunitoFamily) },
            confirmButton = {
                TextButton(onClick = { confirmDelete = null; onDelete(bed) }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }
}
```

- [ ] **Step 4: Запустить тест — должен пройти**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests "ru.dachakalend.app.plantings.RotationWarningTest"`
Expected: PASS (3 теста зелёные).

- [ ] **Step 5: Скомпилировать весь модуль**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/BedPickerField.kt \
        android/app/src/test/java/ru/dachakalend/app/plantings/RotationWarningTest.kt
git commit -m "feat(android): BedPickerField + rotationWarning (с юнит-тестом)"
```

---

### Task 4: Подключить пикер в шторки создания и редактирования посадки

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsViewModel.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsScreen.kt`

- [ ] **Step 1: VM — внедрить `BedsRepository`, добавить состояние грядок**

В `PlantingsViewModel.kt`:

Добавить импорты (рядом с прочими `import ru.dachakalend.app.data.*`):
```kotlin
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.repository.BedsRepository
```

В конструктор добавить зависимость (первым параметром после существующих репозиториев):
```kotlin
@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val bedsRepository: BedsRepository,
    private val tokenStorage: TokenStorage,
    savedStateHandle: SavedStateHandle
) : ViewModel() {
```

В `data class PlantingsUiState(...)` добавить поля (после `val pendingCropTransplantDays: Int? = null,`):
```kotlin
    val pendingCropFamily: String? = null,
    val editingCropFamily: String? = null,
    val beds: List<GardenBed> = emptyList(),
```

- [ ] **Step 2: VM — грузить грядки и семейство культуры**

В `init { ... }` после `loadPlantings()` добавить:
```kotlin
        loadBeds()
```

Заменить метод `loadPendingCropDefault` целиком на (теперь забираем и семейство):
```kotlin
    /** Грузим культуру для дефолта способа посадки (рассада) и семейства (подсказка севооборота). */
    private fun loadPendingCropDefault(cropId: Int) {
        viewModelScope.launch {
            val crop = (cropsRepository.getCrop(cropId) as? Result.Success)?.data
            _uiState.value = _uiState.value.copy(
                pendingCropTransplantDays = crop?.transplantDays,
                pendingCropFamily = crop?.family
            )
        }
    }

    private fun loadBeds() {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 } ?: return@launch
            when (val res = bedsRepository.getBeds(gardenId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(beds = res.data)
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }
```

- [ ] **Step 3: VM — CRUD грядок (для пикера)**

Добавить методы (например, после `loadBeds()`):
```kotlin
    /** Создать грядку и сразу выбрать её — onSelected получает созданный объект. */
    fun createBed(name: String, type: String, onSelected: (GardenBed) -> Unit) {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 } ?: return@launch
            when (val res = bedsRepository.createBed(gardenId, name, type)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds + res.data)
                    onSelected(res.data)
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(error = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun renameBed(bed: GardenBed, name: String) {
        viewModelScope.launch {
            when (val res = bedsRepository.updateBed(bed.id, name = name)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(
                        beds = _uiState.value.beds.map { if (it.id == res.data.id) res.data else it }
                    )
                is Result.Error -> _uiState.value = _uiState.value.copy(error = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun deleteBed(bed: GardenBed) {
        viewModelScope.launch {
            when (bedsRepository.deleteBed(bed.id)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds.filter { it.id != bed.id })
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }
```

- [ ] **Step 4: VM — семейство культуры при открытии правки + проброс `bedId`**

Заменить `openEditSheet` на (подгружаем семейство редактируемой культуры для подсказки):
```kotlin
    fun openEditSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(editingPlanting = planting, editingCropFamily = null)
        viewModelScope.launch {
            val family = (cropsRepository.getCrop(planting.cropId) as? Result.Success)?.data?.family
            _uiState.value = _uiState.value.copy(editingCropFamily = family)
        }
    }
```

Заменить сигнатуры/тела `confirmPlanting`, `createPlanting`, `saveEditedInfo` — добавить `bedId`:
```kotlin
    fun confirmPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null, pendingCropFamily = null)
        createPlanting(cropId, date, quantity, conditions, sowingMethod, variety, bedId)
    }
```
```kotlin
    private fun createPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) {
                _uiState.value = _uiState.value.copy(error = "Участок не найден")
                return@launch
            }
            val request = CreatePlantingRequest(
                cropId = cropId,
                gardenId = gardenId,
                sownAt = date,
                quantity = quantity,
                conditions = conditions,
                sowingMethod = sowingMethod,
                variety = variety,
                bedId = bedId
            )
            when (val result = plantingsRepository.createPlanting(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка добавлена!")
                    loadPlantings()
                    loadBeds()
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }
```
```kotlin
    fun saveEditedInfo(plantingId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
        _uiState.value = _uiState.value.copy(editingPlanting = null, editingCropFamily = null)
        viewModelScope.launch {
            // variety: null → не передаём (сервер не трогает); '' → сброс; текст → запись.
            // bedId: null → не трогаем грядку (бэкенд COALESCE; снять привязку нельзя — см. план).
            val request = UpdatePlantingInfoRequest(
                plantedAt = date, quantity = quantity, conditions = conditions,
                sowingMethod = sowingMethod, variety = variety ?: "", bedId = bedId
            )
            when (plantingsRepository.updateInfo(plantingId, request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка обновлена!")
                    loadPlantings()
                    loadBeds()
                }
                is Result.Error   -> Unit
                is Result.Loading -> Unit
            }
        }
    }
```

В `dismissSetupSheet()` добавить сброс семейства:
```kotlin
    fun dismissSetupSheet() {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null, pendingCropFamily = null)
    }
```

- [ ] **Step 5: Экран — передать грядки/колбэки в шторки**

В `PlantingsScreen.kt`, в блоке `state.pendingCropId?.let { cropId -> ... }` заменить вызов `PlantingSetupBottomSheet(...)` на:
```kotlin
        PlantingSetupBottomSheet(
            defaultSeedling = state.pendingCropTransplantDays != null,
            beds = state.beds,
            cropFamily = state.pendingCropFamily,
            onCreateBed = { name, type, onSelected -> viewModel.createBed(name, type, onSelected) },
            onRenameBed = viewModel::renameBed,
            onDeleteBed = viewModel::deleteBed,
            onConfirm = { date, qty, cond, method, variety, bedId -> viewModel.confirmPlanting(cropId, date, qty, cond, method, variety, bedId) },
            onDismiss = { viewModel.dismissSetupSheet() }
        )
```

В блоке `state.editingPlanting?.let { planting -> ... }` заменить вызов `PlantingEditBottomSheet(...)` на:
```kotlin
        PlantingEditBottomSheet(
            planting = planting,
            beds = state.beds,
            cropFamily = state.editingCropFamily,
            onCreateBed = { name, type, onSelected -> viewModel.createBed(name, type, onSelected) },
            onRenameBed = viewModel::renameBed,
            onDeleteBed = viewModel::deleteBed,
            onConfirm = { date, qty, cond, method, variety, bedId -> viewModel.saveEditedInfo(planting.id, date, qty, cond, method, variety, bedId) },
            onDismiss = { viewModel.dismissEditSheet() }
        )
```

- [ ] **Step 6: Экран — `PlantingSetupBottomSheet`: новые параметры, состояние bedId, пикер, авто-подстановка условий**

Заменить сигнатуру `PlantingSetupBottomSheet` и добавить состояние/пикер. Новая сигнатура:
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingSetupBottomSheet(
    defaultSeedling: Boolean,
    beds: List<GardenBed>,
    cropFamily: String?,
    onCreateBed: (name: String, type: String, onSelected: (GardenBed) -> Unit) -> Unit,
    onRenameBed: (bed: GardenBed, name: String) -> Unit,
    onDeleteBed: (bed: GardenBed) -> Unit,
    onConfirm: (date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String?, bedId: Int?) -> Unit,
    onDismiss: () -> Unit
) {
```

Внутри, рядом с прочими `var ... by remember`, добавить:
```kotlin
    var bedId by remember { mutableStateOf<Int?>(null) }
```

Вставить пикер в `Column` **между** блоком «Сорт» (`OutlinedTextField` для `variety`) и блоком `Text("Место посадки", ...)` (чипы Грунт/Теплица — это «Условия»). Порядок по спеке: причина (грядка) выше следствия (условия):
```kotlin
            BedPickerField(
                beds = beds,
                selectedBedId = bedId,
                cropFamily = cropFamily,
                allowClear = true,
                onSelect = { bed ->
                    bedId = bed?.id
                    if (bed != null) conditions = bed.type   // авто-подстановка условий из типа грядки
                },
                onCreate = { name, type -> onCreateBed(name, type) { created -> bedId = created.id; conditions = created.type } },
                onRename = onRenameBed,
                onDelete = onDeleteBed,
            )
```

Обновить вызов `onConfirm` в кнопке «Посадить» — добавить `bedId`:
```kotlin
                onClick = {
                    onConfirm(date, quantity.toIntOrNull() ?: 1, conditions, sowingMethod, variety.trim().ifEmpty { null }, bedId)
                },
```

- [ ] **Step 7: Экран — `PlantingEditBottomSheet`: то же, с предзаполнением `bedId`**

Заменить сигнатуру `PlantingEditBottomSheet`:
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingEditBottomSheet(
    planting: Planting,
    beds: List<GardenBed>,
    cropFamily: String?,
    onCreateBed: (name: String, type: String, onSelected: (GardenBed) -> Unit) -> Unit,
    onRenameBed: (bed: GardenBed, name: String) -> Unit,
    onDeleteBed: (bed: GardenBed) -> Unit,
    onConfirm: (date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String?, bedId: Int?) -> Unit,
    onDismiss: () -> Unit
) {
```

Рядом с прочими `var ... by remember` добавить предзаполнение из посадки:
```kotlin
    var bedId by remember { mutableStateOf(planting.bedId) }
```

Вставить пикер в `Column` между блоком «Сорт» и `Text("Место посадки", ...)`. Важно: `allowClear = false` — снять привязку через PATCH info нельзя (бэкенд COALESCE), поэтому пункт «Не выбрано» при правке не показываем:
```kotlin
            BedPickerField(
                beds = beds,
                selectedBedId = bedId,
                cropFamily = cropFamily,
                allowClear = false,
                onSelect = { bed ->
                    bedId = bed?.id
                    if (bed != null) conditions = bed.type
                },
                onCreate = { name, type -> onCreateBed(name, type) { created -> bedId = created.id; conditions = created.type } },
                onRename = onRenameBed,
                onDelete = onDeleteBed,
            )
```

Обновить вызов `onConfirm` в кнопке «Сохранить» — добавить `bedId`:
```kotlin
                onClick = { onConfirm(date, quantity.toIntOrNull() ?: 1, conditions, sowingMethod, variety.trim().ifEmpty { null }, bedId) },
```

- [ ] **Step 8: Добавить импорт модели в экран**

В начало `PlantingsScreen.kt` к импортам добавить:
```kotlin
import ru.dachakalend.app.data.model.GardenBed
```

- [ ] **Step 9: Скомпилировать**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 10: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsViewModel.kt \
        android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingsScreen.kt
git commit -m "feat(android): поле «Место» в шторках создания и правки посадки"
```

---

### Task 5: Показ и правка «Места» на экране деталей посадки

**Files:**
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoViewModel.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoScreen.kt`

- [ ] **Step 1: VM — внедрить `BedsRepository`, грузить грядки, метод правки места**

В `PlantingInfoViewModel.kt`:

Импорты:
```kotlin
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.model.UpdatePlantingInfoRequest
import ru.dachakalend.app.data.repository.BedsRepository
```

В конструктор добавить (после `plantingsRepository`):
```kotlin
    private val bedsRepository: BedsRepository,
```

В `data class PlantingInfoUiState(...)` добавить:
```kotlin
    val beds: List<GardenBed> = emptyList(),
```

В методе `load(...)`, после того как получен `planting` (после блока с `cropDeferred/actionsDeferred/guideDeferred` и установки `_uiState.value = PlantingInfoUiState(...)`), добавить загрузку грядок участка — вставить перед `loadPhotos(plantingId)`:
```kotlin
            loadBeds(planting.gardenId)
```

Добавить методы:
```kotlin
    private fun loadBeds(gardenId: Int) {
        viewModelScope.launch {
            when (val res = bedsRepository.getBeds(gardenId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(beds = res.data)
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    /** Привязать посадку к выбранной грядке (со снимком типа в условия — как при создании). */
    fun setBed(bed: GardenBed) {
        val planting = _uiState.value.planting ?: return
        viewModelScope.launch {
            val res = plantingsRepository.updateInfo(planting.id, UpdatePlantingInfoRequest(bedId = bed.id, conditions = bed.type))
            if (res is Result.Success) {
                _uiState.value = _uiState.value.copy(planting = res.data)
            }
        }
    }

    fun createAndSetBed(name: String, type: String) {
        val planting = _uiState.value.planting ?: return
        viewModelScope.launch {
            when (val created = bedsRepository.createBed(planting.gardenId, name, type)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds + created.data)
                    setBed(created.data)
                }
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    fun renameBed(bed: GardenBed, name: String) {
        viewModelScope.launch {
            when (val res = bedsRepository.updateBed(bed.id, name = name)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds.map { if (it.id == res.data.id) res.data else it })
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    fun deleteBed(bed: GardenBed) {
        viewModelScope.launch {
            when (bedsRepository.deleteBed(bed.id)) {
                is Result.Success -> {
                    val planting = _uiState.value.planting
                    _uiState.value = _uiState.value.copy(
                        beds = _uiState.value.beds.filter { it.id != bed.id },
                        // ON DELETE SET NULL на сервере: если удалили текущую грядку — локально снимаем привязку.
                        planting = if (planting?.bedId == bed.id) planting.copy(bedId = null) else planting
                    )
                }
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }
```

- [ ] **Step 2: Экран — пробросить колбэки в `AboutTab`**

В `PlantingInfoScreen.kt`, в `when (tab) { 0 -> AboutTab(...) }` заменить вызов на:
```kotlin
                    0 -> AboutTab(
                        state, scroll,
                        onUpload = { bytes, actionId -> viewModel.uploadPhoto(planting.id, bytes, actionId) },
                        onDelete = viewModel::deletePhoto,
                        onReplace = { p, bytes -> viewModel.replacePhoto(p, bytes) },
                        onDeleteRecord = viewModel::deleteAction,
                        onSelectBed = viewModel::setBed,
                        onCreateBed = viewModel::createAndSetBed,
                        onRenameBed = viewModel::renameBed,
                        onDeleteBed = viewModel::deleteBed,
                    )
```

- [ ] **Step 3: Экран — `AboutTab`: новые параметры + строка/правка «Места»**

Заменить сигнатуру `AboutTab`:
```kotlin
@Composable
private fun AboutTab(
    state: PlantingInfoUiState,
    modifier: Modifier,
    onUpload: (ByteArray, Int?) -> Unit,
    onDelete: (Int) -> Unit,
    onReplace: (PlantingPhoto, ByteArray) -> Unit,
    onDeleteRecord: (Int) -> Unit,
    onSelectBed: (ru.dachakalend.app.data.model.GardenBed) -> Unit,
    onCreateBed: (name: String, type: String) -> Unit,
    onRenameBed: (bed: ru.dachakalend.app.data.model.GardenBed, name: String) -> Unit,
    onDeleteBed: (bed: ru.dachakalend.app.data.model.GardenBed) -> Unit,
) {
```

Внутри `AboutTab`, в `InfoSection(title = "Посадка") { ... }`, после строки `InfoRow2("Условия", ...)` добавить отображение текущего места (только просмотр-строка):
```kotlin
            val currentBed = state.beds.firstOrNull { it.id == planting.bedId }
            InfoRow2("Место", currentBed?.name ?: "не выбрано")
```

После закрывающей `}` блока `InfoSection(title = "Посадка")` добавить отдельную секцию с пикером для правки задним числом (семейство берём из уже загруженной культуры — `state.crop?.family`):
```kotlin
        InfoSection(title = "Место (грядка)") {
            BedPickerField(
                beds = state.beds,
                selectedBedId = planting.bedId,
                cropFamily = state.crop?.family,
                allowClear = false,                 // снять привязку через PATCH info нельзя (см. план)
                onSelect = { bed -> bed?.let { onSelectBed(it) } },
                onCreate = onCreateBed,
                onRename = onRenameBed,
                onDelete = onDeleteBed,
            )
        }
```

- [ ] **Step 4: Скомпилировать**

Run: `cd android && ./gradlew :app:compileDebugKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoViewModel.kt \
        android/app/src/main/java/ru/dachakalend/app/ui/plantings/PlantingInfoScreen.kt
git commit -m "feat(android): просмотр и правка «Места» (грядки) на экране деталей посадки"
```

---

### Task 6: Сборка, юнит-тесты и ручной QA

**Files:** нет новых — финальная проверка.

- [ ] **Step 1: Юнит-тесты**

Run: `cd android && ./gradlew :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL (включая `RotationWarningTest` и существующие тесты, без регрессий).

- [ ] **Step 2: Полная сборка debug APK**

Run: `cd android && ./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL.

> Если сборка из CLI падает на сертификатах VK artifactory / JBR — см. memory `reference_dacha_android_cli_build` (JBR `JAVA_HOME` + truststore с HARICA-сертификатом). Это инфраструктурный нюанс, не дефект кода.

- [ ] **Step 3: Ручной прогон на эмуляторе/устройстве (тест-аккаунт demo@dacha.ru / demo1234, участок Краснодар)**

1. Открыть «Посадки» → «+» → выбрать культуру (например, Перец — Паслёновые) → в шторке параметров появилось поле **«Место (необязательно)»** между «Сорт» и «Место посадки».
2. Тап по полю → «Новая грядка» → ввести «Теплица 1», выбрать «Теплица» → «Добавить» → поле показывает «Теплица 1 · теплица», чип «Условия» автоматически переключился на «Теплица».
3. Сохранить посадку. Создать вторую посадку Томата (тоже Паслёновые) на «Теплица 1» (если на грядке уже есть история паслёновых за 3 года) → под полем «Место» появляется мягкое предупреждение о севообороте с годом и культурой.
4. Культура другого семейства (Огурец — Тыквенные) на той же грядке → предупреждения нет.
5. Открыть карточку посадки (тап) → вкладка «О посадке» → строка «Место: Теплица 1» и секция «Место (грядка)» с пикером; сменить грядку → значение обновилось.
6. Переименовать грядку через иконку карандаша в пикере → имя обновилось и в шторках, и на деталях.
7. Удалить грядку → диалог подтверждения → грядка пропала; посадка на ней не падает, «Место» стало «не выбрано».
8. Создать посадку вовсе без «Места» → сохраняется как раньше, на деталях «Место: не выбрано», без подсказок.

- [ ] **Step 4: Commit (если по итогам QA были правки)**

```bash
git add -A
git commit -m "fix(android): правки по итогам ручного QA грядок"
```
(Если правок не было — коммит не нужен.)

---

## Self-review

**1. Покрытие спеки (раздел 3, Android-часть):**
- поле «Место» между «Культура/Сорт» и «Условиями» — Task 4 (обе шторки), Task 5 (детали);
- инлайн «+ Новая грядка» с чипами Грунт/Теплица — Task 3 (`BedPickerField`);
- переименование/удаление (иконки у строки — Android-вариант web-иконок; long-press из спеки заменён явными иконками, т.к. удобнее в выпадающем меню) — Task 3;
- авто-подстановка «Условий» из типа грядки с возможностью переопределить вручную — Task 4 шаги 6–7 (`if (bed != null) conditions = bed.type`, чипы остаются доступны);
- мягкое предупреждение о севообороте — Task 3 (`rotationWarning`, покрыта тестом);
- поле необязательно, старые посадки без «Места» работают — Task 4/5 (`bedId` nullable, `allowClear`);
- просмотр/правка задним числом на экране посадки — Task 5.
- Открытый вопрос спеки («есть ли готовый searchable-комбобокс на Android») разрешён: готового переиспользуемого нет (крупный поиск культур идёт отдельным экраном-каталогом), поэтому собран новый компактный `BedPickerField` на `DropdownMenu` — грядок немного, полнотекстовый поиск не нужен.

**2. Плейсхолдеров нет** — каждый код-блок исполняемый; реальные сигнатуры и пути.

**3. Согласованность типов:** `GardenBed.gardenId` nullable (список его не отдаёт); `rotationWarning(bed, cropFamily)` — единая сигнатура в компоненте и тесте; `bedId: Int?` единообразно в `Planting`/`CreatePlantingRequest`/`UpdatePlantingInfoRequest` и во всех VM-методах; CRUD-колбэки `BedPickerField` совпадают по сигнатурам с тем, что отдают оба VM.

**4. Ограничение «снять привязку нельзя» (бэкенд COALESCE)** учтено: `allowClear = true` только в шторке создания (там грядки ещё нет), `allowClear = false` при правке и на деталях; отвязка происходит лишь при удалении грядки (`ON DELETE SET NULL`, отражено локально в `deleteBed`).

**5. Отличие от web (осознанное):** на Android культура выбирается отдельным экраном-каталогом, а не инлайн-комбобоксом, поэтому «Место» живёт в шторке параметров (`PlantingSetupBottomSheet`), а не рядом с выбором культуры — это эквивалент «между Культурой и Условиями» в рамках Android-флоу.
