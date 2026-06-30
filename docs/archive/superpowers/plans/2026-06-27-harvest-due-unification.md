# Унификация действия «Убрать урожай» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Связать карточку задачи дня «Убрать урожай» с уже существующим логом урожая (`harvests`) на Android и вебе, без преждевременного завершения сезона у многоразовых культур, и добавить недостающий на вебе пункт «Завершить сезон».

**Architecture:** Backend получает cooldown-проверку в `buildTasks()` (3 дня после последнего `harvests`-лога по посадке — без новых таблиц/полей). Android получает переиспользуемую `AddHarvestSheet` с опциональным преселектом посадки и чекбоксом «весь урожай в сезоне», подключённую к клику по карточке `harvest_due` на «Сегодня» через новый лёгкий `HarvestLogViewModel`/`HarvestLogBottomSheet`. Веб получает зеркальный `HarvestLogModal` для того же клика, тот же чекбокс в существующей форме журнала, и новую кнопку «Завершить сезон» на странице посадки.

**Tech Stack:** Backend — Fastify/Postgres/vitest. Android — Kotlin/Compose/Hilt/MockK/Turbine. Web — React/TypeScript, без автотестов (только `tsc`/ручная проверка).

Спека: `docs/superpowers/specs/2026-06-27-harvest-due-unification-design.md`

---

### Task 1: Backend — cooldown для `harvest_due`

**Files:**
- Modify: `backend/src/utils/todayLogic.js`
- Modify: `backend/src/routes/today.js`
- Test: `backend/src/__tests__/unit/todayLogic.test.js`

- [ ] **Step 1: Написать падающие тесты**

В `backend/src/__tests__/unit/todayLogic.test.js`, внутри `describe('harvest_due', ...)` (после существующего теста `'появляется для прямого посева на stage=sowing (растёт в грунте)'`, перед закрывающей `})` блока `describe`), добавить:

```js
  it('НЕ появляется если урожай уже собирали в последние 3 дня', () => {
    const lastHarvested = { 1: new Date(daysAgo(2, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY, {}, null, {}, lastHarvested
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(false)
  })

  it('появляется снова, если последний сбор был больше 3 дней назад', () => {
    const lastHarvested = { 1: new Date(daysAgo(4, TODAY)) }
    const tasks = buildTasks(
      [makePlanting({ stage: 'growing', harvest_days: 10, planted_at: daysAgo(15, TODAY) })],
      makeWeather(), {}, {}, [], TODAY, {}, null, {}, lastHarvested
    )
    expect(tasks.some(t => t.type === 'harvest_due')).toBe(true)
  })
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd backend && npx vitest run src/__tests__/unit/todayLogic.test.js -t "harvest_due"`
Expected: FAIL — оба новых теста (10-й позиционный аргумент `buildTasks` сейчас не читается, тело функции не делает с ним ничего; первый новый тест ожидает `false`, но задача всё равно появится).

- [ ] **Step 3: Добавить константу cooldown в `todayLogic.js`**

Рядом с объявлением `OVERDUE_WINDOW_DAYS` (строка 10):

```js
const OVERDUE_WINDOW_DAYS = 21
```
заменить на:
```js
const OVERDUE_WINDOW_DAYS = 21

// Сколько дней не повторять harvest_due после лога в harvests — иначе многоразовые культуры
// (огурцы, малина) получали бы карточку каждый день сразу после очередного сбора.
const HARVEST_COOLDOWN_DAYS = 3
```

- [ ] **Step 4: Добавить параметр `lastHarvestedMap` и проверку cooldown**

Изменить сигнатуру `buildTasks` (строка 187):
```js
function buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminders, today = new Date(), careActionsToday = {}, precipProb = null, lastCareActionMap = {}) {
```
на:
```js
function buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminders, today = new Date(), careActionsToday = {}, precipProb = null, lastCareActionMap = {}, lastHarvestedMap = {}) {
```

Заменить блок `harvest_due` (строки 318-333):
```js
    // 🌾 Пора убирать урожай.
    // Прямой посев растёт в грунте с момента посева (стадия остаётся 'sowing'), поэтому для него
    // урожай считаем по harvest_days напрямую; рассадные — после высадки (growing/flowering/harvesting/…).
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      (p.sowing_method === 'direct' || ['growing', 'flowering', 'harvesting', 'transplanted'].includes(p.stage))
    ) {
      tasks.push({
        type: 'harvest_due',
        priority: TASK_PRIORITY.harvest_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора убирать урожай!`,
      })
    }
  }
```
на:
```js
    // 🌾 Пора убирать урожай.
    // Прямой посев растёт в грунте с момента посева (стадия остаётся 'sowing'), поэтому для него
    // урожай считаем по harvest_days напрямую; рассадные — после высадки (growing/flowering/harvesting/…).
    // После лога в harvests — не повторяем карточку HARVEST_COOLDOWN_DAYS дней.
    const lastHarvested = lastHarvestedMap[p.id]
    const daysSinceHarvest = lastHarvested ? Math.floor((today - lastHarvested) / 86400000) : Infinity
    if (
      p.harvest_days &&
      daysSincePlanting >= p.harvest_days &&
      daysSinceHarvest >= HARVEST_COOLDOWN_DAYS &&
      (p.sowing_method === 'direct' || ['growing', 'flowering', 'harvesting', 'transplanted'].includes(p.stage))
    ) {
      tasks.push({
        type: 'harvest_due',
        priority: TASK_PRIORITY.harvest_due,
        planting_id: p.id,
        crop_name: p.crop_name,
        message: `${p.crop_name} — пора убирать урожай!`,
      })
    }
  }
```

- [ ] **Step 5: Запустить тесты, убедиться что проходят**

Run: `cd backend && npx vitest run src/__tests__/unit/todayLogic.test.js`
Expected: PASS (весь файл, включая 2 новых теста).

- [ ] **Step 6: Подключить `lastHarvestedMap` в `routes/today.js`**

В `backend/src/routes/today.js`, после блока `// ── 3.7. ПОСЛЕДНЕЕ CARE-ДЕЙСТВИЕ ПО ТИПУ...` (заканчивается строкой 108, перед `// ── 4. НАПОМИНАНИЯ НА СЕГОДНЯ`), вставить:

```js
    // ── 3.8. ПОСЛЕДНИЙ СБОР УРОЖАЯ (cooldown для harvest_due) ───────────────
    let lastHarvestedMap = {}
    if (plantings.length > 0) {
      const ids = plantings.map(p => p.id)
      const harvestRes = await fastify.db.query(
        `SELECT DISTINCT ON (planting_id) planting_id, harvested_at
         FROM harvests
         WHERE planting_id = ANY($1)
         ORDER BY planting_id, harvested_at DESC`,
        [ids]
      )
      harvestRes.rows.forEach(r => {
        lastHarvestedMap[r.planting_id] = new Date(r.harvested_at)
      })
    }

```

Заменить вызов `buildTasks` (строка 132):
```js
    const rawTasks = buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminderTasks, today, careActionsToday, weather?.precip_prob_pct ?? null, lastCareActionMap)
```
на:
```js
    const rawTasks = buildTasks(plantings, weather, lastWateredMap, lastFertilizedMap, reminderTasks, today, careActionsToday, weather?.precip_prob_pct ?? null, lastCareActionMap, lastHarvestedMap)
```

- [ ] **Step 7: Прогнать весь backend-набор**

Run: `cd backend && npx vitest run`
Expected: PASS — все файлы зелёные (база 388 + 2 новых = 390).

- [ ] **Step 8: Commit**

```bash
git add backend/src/utils/todayLogic.js backend/src/routes/today.js backend/src/__tests__/unit/todayLogic.test.js
git commit -m "feat(today): cooldown 3 дня для harvest_due после лога урожая"
```

---

### Task 2: Android — вынести и расширить `AddHarvestSheet`

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/ui/harvest/AddHarvestSheet.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestScreen.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestViewModel.kt`

- [ ] **Step 1: Создать `AddHarvestSheet.kt` с расширенным API**

Создать файл `android/app/src/main/java/ru/dachakalend/app/ui/harvest/AddHarvestSheet.kt`:

```kotlin
package ru.dachakalend.app.ui.harvest

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Шторка записи урожая. Если [preselectedPlanting] задан — поле культуры зафиксировано
 * (клик по карточке «Убрать урожай» на «Сегодня»), иначе — выпадающий список из [plantings]
 * (журнал урожая, HarvestScreen).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddHarvestSheet(
    plantings: List<Planting>,
    preselectedPlanting: Planting? = null,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?, finishSeason: Boolean) -> Unit
) {
    var selectedPlanting by remember { mutableStateOf(preselectedPlanting ?: plantings.firstOrNull()) }
    var weightText by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var finishSeason by remember { mutableStateOf(false) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .imePadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Записать урожай",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            if (preselectedPlanting != null) {
                OutlinedTextField(
                    value = preselectedPlanting.cropName ?: "Посадка #${preselectedPlanting.id}",
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text("Культура", fontFamily = NunitoFamily) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
            } else {
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedPlanting?.cropName
                            ?: selectedPlanting?.let { "Посадка #${it.id}" }
                            ?: "Нет посадок",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Культура", fontFamily = NunitoFamily) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(dropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        plantings.forEach { planting ->
                            DropdownMenuItem(
                                text = { Text(planting.cropName ?: "Посадка #${planting.id}", fontFamily = NunitoFamily) },
                                onClick = {
                                    selectedPlanting = planting
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = weightText,
                    onValueChange = { weightText = it },
                    label = { Text("Вес, кг", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Штук", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 4,
                minLines = 2,
                shape = RoundedCornerShape(12.dp)
            )

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Checkbox(checked = finishSeason, onCheckedChange = { finishSeason = it })
                Text(
                    "Это весь урожай в этом сезоне",
                    fontFamily = NunitoFamily,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            Button(
                onClick = {
                    val pid = selectedPlanting?.id ?: return@Button
                    onSave(
                        pid,
                        weightText.toDoubleOrNull(),
                        quantityText.toIntOrNull(),
                        notes.ifBlank { null },
                        finishSeason
                    )
                },
                enabled = selectedPlanting != null && !isSaving &&
                        (weightText.toDoubleOrNull() != null || quantityText.toIntOrNull() != null),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(
                        "Сохранить",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        softWrap = false
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 2: Удалить старую `AddHarvestSheet` из `HarvestScreen.kt` и обновить вызов**

В `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestScreen.kt` удалить весь блок `private fun AddHarvestSheet(...) { ... }` (строки 374-504 — от `@OptIn(ExperimentalMaterial3Api::class)` перед `private fun AddHarvestSheet` до закрывающей `}` этой функции). Файл находится в том же пакете `ru.dachakalend.app.ui.harvest` — новый `AddHarvestSheet` доступен без импорта.

Заменить вызов (строки 103-111):
```kotlin
    if (state.showAddSheet) {
        AddHarvestSheet(
            plantings = state.plantings,
            isSaving = state.isSaving,
            onDismiss = { viewModel.closeAddSheet() },
            onSave = { plantingId, weightKg, quantity, notes ->
                viewModel.addHarvest(plantingId, weightKg, quantity, notes)
            }
        )
    }
```
на:
```kotlin
    if (state.showAddSheet) {
        AddHarvestSheet(
            plantings = state.plantings,
            isSaving = state.isSaving,
            onDismiss = { viewModel.closeAddSheet() },
            onSave = { plantingId, weightKg, quantity, notes, finishSeason ->
                viewModel.addHarvest(plantingId, weightKg, quantity, notes, finishSeason)
            }
        )
    }
```

Удалить из импортов (строки 8 и 19 — больше не используются в этом файле, остальные композаблы их не вызывают):
```kotlin
import androidx.compose.foundation.text.KeyboardOptions
```
и
```kotlin
import androidx.compose.ui.text.input.KeyboardType
```

- [ ] **Step 3: Обновить `HarvestViewModel.addHarvest`**

В `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestViewModel.kt` заменить:
```kotlin
    fun addHarvest(plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true)
            when (val result = harvestRepository.addHarvest(plantingId, weightKg, quantity, notes)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        showAddSheet = false,
                        successMessage = "Урожай записан!"
                    )
                    load()
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    error = result.message
                )
                is Result.Loading -> Unit
            }
        }
    }
```
на:
```kotlin
    fun addHarvest(plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?, finishSeason: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true)
            when (val result = harvestRepository.addHarvest(plantingId, weightKg, quantity, notes)) {
                is Result.Success -> {
                    if (finishSeason) plantingsRepository.updateStage(plantingId, "done")
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        showAddSheet = false,
                        successMessage = "Урожай записан!"
                    )
                    load()
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    error = result.message
                )
                is Result.Loading -> Unit
            }
        }
    }
```

- [ ] **Step 4: Скомпилировать и проверить юнит-тесты**

Run (PowerShell/Bash, `JAVA_HOME` = JBR — см. `docs/superpowers/...` или предыдущие сессии для пути):
```bash
cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH" ./gradlew.bat :app:testGplayDebugUnitTest --console=plain
```
Expected: BUILD SUCCESSFUL (новых тестов в этой задаче нет — проверяем, что существующие не сломались и всё компилируется).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/harvest/
git commit -m "refactor(harvest): вынести AddHarvestSheet, добавить преселект посадки и чекбокс завершения сезона"
```

---

### Task 3: Android — клик по карточке «Убрать урожай» на «Сегодня»

**Files:**
- Create: `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestLogViewModel.kt`
- Create: `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestLogBottomSheet.kt`
- Modify: `android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt`
- Test: `android/app/src/test/java/ru/dachakalend/app/harvest/HarvestLogViewModelTest.kt`

- [ ] **Step 1: Написать падающий тест для `HarvestLogViewModel`**

Создать файл `android/app/src/test/java/ru/dachakalend/app/harvest/HarvestLogViewModelTest.kt`:

```kotlin
package ru.dachakalend.app.harvest

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ru.dachakalend.app.data.model.Harvest
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.repository.HarvestRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.harvest.HarvestLogViewModel

@OptIn(ExperimentalCoroutinesApi::class)
class HarvestLogViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var harvestRepository: HarvestRepository
    private lateinit var plantingsRepository: PlantingsRepository
    private lateinit var viewModel: HarvestLogViewModel

    private fun fakeHarvest() = Harvest(
        id = 1, plantingId = 1, cropName = "Огурец",
        weightKg = 1.5, quantity = 5, notes = null,
        harvestedAt = "2026-06-27T10:00:00Z"
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        harvestRepository = mockk()
        plantingsRepository = mockk()
        viewModel = HarvestLogViewModel(harvestRepository, plantingsRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `logHarvest без finishSeason не завершает сезон`() = runTest {
        coEvery { harvestRepository.addHarvest(1, 1.5, 5, null) } returns Result.Success(fakeHarvest())

        var done = false
        viewModel.logHarvest(1, 1.5, 5, null, finishSeason = false) { done = true }
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(done)
        coVerify(exactly = 0) { plantingsRepository.updateStage(any(), any()) }
    }

    @Test
    fun `logHarvest с finishSeason=true переводит посадку в done`() = runTest {
        coEvery { harvestRepository.addHarvest(1, 1.5, 5, null) } returns Result.Success(fakeHarvest())
        coEvery { plantingsRepository.updateStage(1, "done") } returns Result.Success(mockk<Planting>())

        var done = false
        viewModel.logHarvest(1, 1.5, 5, null, finishSeason = true) { done = true }
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(done)
        coVerify(exactly = 1) { plantingsRepository.updateStage(1, "done") }
    }

    @Test
    fun `logHarvest при ошибке не вызывает onDone`() = runTest {
        coEvery { harvestRepository.addHarvest(1, 1.5, 5, null) } returns Result.Error("network")

        var done = false
        viewModel.logHarvest(1, 1.5, 5, null, finishSeason = false) { done = true }
        dispatcher.scheduler.advanceUntilIdle()

        assertFalse(done)
        coVerify(exactly = 0) { plantingsRepository.updateStage(any(), any()) }
    }
}
```

- [ ] **Step 2: Запустить тест, убедиться что падает (класс не существует)**

Run:
```bash
cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH" ./gradlew.bat :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.harvest.HarvestLogViewModelTest" --console=plain
```
Expected: FAIL — `Unresolved reference: HarvestLogViewModel` (компиляция тестов не пройдёт, класса ещё нет).

- [ ] **Step 3: Создать `HarvestLogViewModel.kt`**

Создать файл `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestLogViewModel.kt`:

```kotlin
package ru.dachakalend.app.ui.harvest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.HarvestRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

/** Лёгкий ViewModel для шторки быстрого лога урожая с карточки «Сегодня» — в отличие от
 *  [HarvestViewModel], не грузит весь журнал/список посадок, только пишет одну запись. */
@HiltViewModel
class HarvestLogViewModel @Inject constructor(
    private val harvestRepository: HarvestRepository,
    private val plantingsRepository: PlantingsRepository,
) : ViewModel() {

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    fun logHarvest(
        plantingId: Int,
        weightKg: Double?,
        quantity: Int?,
        notes: String?,
        finishSeason: Boolean,
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            _isSaving.value = true
            when (harvestRepository.addHarvest(plantingId, weightKg, quantity, notes)) {
                is Result.Success -> {
                    if (finishSeason) plantingsRepository.updateStage(plantingId, "done")
                    _isSaving.value = false
                    onDone()
                }
                else -> _isSaving.value = false
            }
        }
    }
}
```

- [ ] **Step 4: Запустить тест, убедиться что проходит**

Run:
```bash
cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH" ./gradlew.bat :app:testGplayDebugUnitTest --tests "ru.dachakalend.app.harvest.HarvestLogViewModelTest" --console=plain
```
Expected: BUILD SUCCESSFUL, 3 теста пройдены.

- [ ] **Step 5: Создать `HarvestLogBottomSheet.kt`**

Создать файл `android/app/src/main/java/ru/dachakalend/app/ui/harvest/HarvestLogBottomSheet.kt`:

```kotlin
package ru.dachakalend.app.ui.harvest

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Planting

/** Шторка лога урожая с карточки «Убрать урожай» на «Сегодня» — посадка преднастроена,
 *  пикер культуры скрыт (см. [AddHarvestSheet]). */
@Composable
fun HarvestLogBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    onLogged: () -> Unit = {},
    viewModel: HarvestLogViewModel = hiltViewModel()
) {
    val isSaving by viewModel.isSaving.collectAsState()
    AddHarvestSheet(
        plantings = listOf(planting),
        preselectedPlanting = planting,
        isSaving = isSaving,
        onDismiss = onDismiss,
        onSave = { plantingId, weightKg, quantity, notes, finishSeason ->
            viewModel.logHarvest(plantingId, weightKg, quantity, notes, finishSeason) {
                onLogged()
                onDismiss()
            }
        }
    )
}
```

- [ ] **Step 6: Подключить в `TodayScreen.kt`**

Добавить импорт (рядом со строкой `import ru.dachakalend.app.ui.actions.ActionLogBottomSheet`):
```kotlin
import ru.dachakalend.app.ui.harvest.HarvestLogBottomSheet
```

В `TodayContent` добавить состояние (после строки `var selectedPlanting by remember { mutableStateOf<Planting?>(null) }`):
```kotlin
    var harvestPlanting by remember { mutableStateOf<Planting?>(null) }  // карточка «Убрать урожай»
```

После блока `ActionLogBottomSheet` (после его закрывающей `}` — там, где сейчас идёт `multiTask?.let { task -> ...`), добавить:
```kotlin
    harvestPlanting?.let { planting ->
        HarvestLogBottomSheet(
            planting  = planting,
            onDismiss = { harvestPlanting = null },
            onLogged  = { onRefresh() }
        )
    }
```

Заменить блок `onClick` карточки задачи (внутри `items(currentTasks, ...)`):
```kotlin
                            SunnyTaskCard(
                                task    = task,
                                onClick = when {
                                    taskPlanting != null -> {
                                        {
                                            selectedPlanting = taskPlanting
                                            quickActionNotes = when (task.type) {
                                                "fertilizing_due" -> task.careTaskName?.let { "Подкормка - $it" }
                                                "care_task_due"   -> treatmentNote(task.careTaskName, task.product)
                                                else              -> null
                                            }
                                            quickActionType  = when (task.type) {
                                                "watering_due"    -> "watering"
                                                "fertilizing_due" -> "fertilizing"
                                                "transplant_due"  -> "transplanting"
                                                "care_task_due"   -> careTaskActionType(task.careTaskName)
                                                else              -> "other"
                                            }
                                        }
                                    }
                                    isGrouped -> {
                                        { multiTask = task }
                                    }
                                    else -> null
                                }
                            )
```
на:
```kotlin
                            SunnyTaskCard(
                                task    = task,
                                onClick = when {
                                    task.type == "harvest_due" && taskPlanting != null -> {
                                        { harvestPlanting = taskPlanting }
                                    }
                                    taskPlanting != null -> {
                                        {
                                            selectedPlanting = taskPlanting
                                            quickActionNotes = when (task.type) {
                                                "fertilizing_due" -> task.careTaskName?.let { "Подкормка - $it" }
                                                "care_task_due"   -> treatmentNote(task.careTaskName, task.product)
                                                else              -> null
                                            }
                                            quickActionType  = when (task.type) {
                                                "watering_due"    -> "watering"
                                                "fertilizing_due" -> "fertilizing"
                                                "transplant_due"  -> "transplanting"
                                                "care_task_due"   -> careTaskActionType(task.careTaskName)
                                                else              -> "other"
                                            }
                                        }
                                    }
                                    isGrouped -> {
                                        { multiTask = task }
                                    }
                                    else -> null
                                }
                            )
```

- [ ] **Step 7: Скомпилировать и прогнать полный набор юнит-тестов**

Run:
```bash
cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH" ./gradlew.bat :app:testGplayDebugUnitTest --console=plain
```
Expected: BUILD SUCCESSFUL — все тесты, включая 3 новых.

- [ ] **Step 8: Commit**

```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/harvest/ android/app/src/main/java/ru/dachakalend/app/ui/today/TodayScreen.kt android/app/src/test/java/ru/dachakalend/app/harvest/
git commit -m "feat(today): клик по карточке «Убрать урожай» открывает лог урожая вместо общего действия"
```

---

### Task 4: Веб — клик по карточке «Убрать урожай» на «Сегодня»

**Files:**
- Create: `web/src/components/HarvestLogModal.tsx`
- Modify: `web/src/screens/TodayScreen.tsx`

- [ ] **Step 1: Создать `HarvestLogModal.tsx`**

Создать файл `web/src/components/HarvestLogModal.tsx`:

```tsx
import { useState } from 'react'
import { api, ApiError } from '../api/client'
import Modal from './Modal'

export default function HarvestLogModal({
  plantingId,
  cropName,
  onClose,
  onLogged,
}: {
  plantingId: number
  cropName?: string | null
  onClose: () => void
  onLogged: () => void
}) {
  const [weight, setWeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [finishSeason, setFinishSeason] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.addHarvest(plantingId, {
        weight_kg: weight ? Number(weight) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      })
      if (finishSeason) await api.updateStage(plantingId, 'done')
      onLogged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} className="flex w-full max-w-sm flex-col gap-3 p-5">
      <h2 className="font-black">Записать урожай{cropName ? `: ${cropName}` : ''}</h2>
      <div className="flex gap-2">
        <input
          className="dacha-input"
          type="number"
          min={0}
          step="0.1"
          placeholder="Вес, кг"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <input
          className="dacha-input"
          type="number"
          min={0}
          placeholder="Штук"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <input
        className="dacha-input"
        placeholder="Заметка (необязательно)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={finishSeason}
          onChange={(e) => setFinishSeason(e.target.checked)}
        />
        Это весь урожай в этом сезоне
      </label>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button className="dacha-chip flex-1 py-3" onClick={onClose}>
          Отмена
        </button>
        <button
          className="dacha-btn flex-1"
          disabled={busy || (!weight && !quantity)}
          onClick={save}
        >
          {busy ? '…' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Подключить в `TodayScreen.tsx`**

Добавить импорт (после `import ActionLogSheet from '../components/ActionLogSheet'`):
```tsx
import HarvestLogModal from '../components/HarvestLogModal'
```

Заменить блок рендера лог-шторки:
```tsx
      {logTask && (logTask.planting_id != null || !!logTask.crop_names_with_ids?.length) && (
        <ActionLogSheet
          plantingId={logTask.planting_id ?? undefined}
          cropName={logTask.crop_name}
          plantings={logTask.crop_names_with_ids ?? undefined}
          title={logTask.crop_names_with_ids?.length ? groupedTitle(logTask) : undefined}
          preselectedType={preselectFor(logTask).type}
          initialNote={preselectFor(logTask).note}
          onClose={() => setLogTask(null)}
          onLogged={() => {
            setLogTask(null)
            load()
          }}
        />
      )}
```
на:
```tsx
      {logTask && logTask.type === 'harvest_due' && logTask.planting_id != null && (
        <HarvestLogModal
          plantingId={logTask.planting_id}
          cropName={logTask.crop_name}
          onClose={() => setLogTask(null)}
          onLogged={() => {
            setLogTask(null)
            load()
          }}
        />
      )}

      {logTask && logTask.type !== 'harvest_due' && (logTask.planting_id != null || !!logTask.crop_names_with_ids?.length) && (
        <ActionLogSheet
          plantingId={logTask.planting_id ?? undefined}
          cropName={logTask.crop_name}
          plantings={logTask.crop_names_with_ids ?? undefined}
          title={logTask.crop_names_with_ids?.length ? groupedTitle(logTask) : undefined}
          preselectedType={preselectFor(logTask).type}
          initialNote={preselectFor(logTask).note}
          onClose={() => setLogTask(null)}
          onLogged={() => {
            setLogTask(null)
            load()
          }}
        />
      )}
```

- [ ] **Step 3: Проверить сборку**

Run: `cd web && npm run build`
Expected: успешная сборка, без ошибок типов (TS2xxx) и без ошибок vite build.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/HarvestLogModal.tsx web/src/screens/TodayScreen.tsx
git commit -m "feat(today): клик по карточке «Убрать урожай» открывает лог урожая вместо общего действия (веб)"
```

---

### Task 5: Веб — чекбокс «весь урожай в сезоне» в журнале урожая

**Files:**
- Modify: `web/src/screens/HarvestsScreen.tsx`

- [ ] **Step 1: Добавить состояние и логику завершения сезона**

Заменить:
```tsx
  const [plantingId, setPlantingId] = useState<number | ''>('')
  const [weight, setWeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
```
на:
```tsx
  const [plantingId, setPlantingId] = useState<number | ''>('')
  const [weight, setWeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [finishSeason, setFinishSeason] = useState(false)
  const [busy, setBusy] = useState(false)
```

Заменить функцию `add`:
```tsx
  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (plantingId === '') {
      setError('Выберите посадку')
      return
    }
    setBusy(true)
    try {
      await api.addHarvest(plantingId, {
        weight_kg: weight ? Number(weight) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      })
      setWeight('')
      setQuantity('')
      setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить')
    } finally {
      setBusy(false)
    }
  }
```
на:
```tsx
  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (plantingId === '') {
      setError('Выберите посадку')
      return
    }
    setBusy(true)
    try {
      await api.addHarvest(plantingId, {
        weight_kg: weight ? Number(weight) : undefined,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      })
      if (finishSeason) await api.updateStage(plantingId, 'done')
      setWeight('')
      setQuantity('')
      setNotes('')
      setFinishSeason(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить')
    } finally {
      setBusy(false)
    }
  }
```

- [ ] **Step 2: Добавить чекбокс в форму**

Заменить:
```tsx
        <input
          className="dacha-input"
          placeholder="Заметка (необязательно)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && (
```
на:
```tsx
        <input
          className="dacha-input"
          placeholder="Заметка (необязательно)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={finishSeason}
            onChange={(e) => setFinishSeason(e.target.checked)}
          />
          Это весь урожай в этом сезоне
        </label>
        {error && (
```

- [ ] **Step 3: Проверить сборку**

Run: `cd web && npm run build`
Expected: успешная сборка без ошибок.

- [ ] **Step 4: Commit**

```bash
git add web/src/screens/HarvestsScreen.tsx
git commit -m "feat(harvests): чекбокс завершения сезона в форме добавления урожая (веб)"
```

---

### Task 6: Веб — кнопка «Завершить сезон» на странице посадки

**Files:**
- Modify: `web/src/screens/PlantingDetailScreen.tsx`

- [ ] **Step 1: Добавить функцию `finishSeason`**

Заменить:
```tsx
  const remove = async () => {
    if (!confirm('Удалить посадку?')) return
    try {
      await api.deletePlanting(plantingId)
      navigate('/plantings', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }
```
на:
```tsx
  const remove = async () => {
    if (!confirm('Удалить посадку?')) return
    try {
      await api.deletePlanting(plantingId)
      navigate('/plantings', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }

  const finishSeason = async () => {
    if (!planting) return
    if (!confirm(`«${planting.crop_name ?? 'Посадка'}» будет переведена в архив. Данные сохранятся.`)) return
    try {
      const updated = await api.updateStage(plantingId, 'done')
      setPlanting(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось завершить сезон')
    }
  }
```

- [ ] **Step 2: Добавить кнопку рядом с удалением**

Заменить:
```tsx
          <button onClick={remove} className="mt-2 font-bold text-red-600">
            Удалить посадку
          </button>
```
на:
```tsx
          {planting.stage !== 'done' && (
            <button onClick={finishSeason} className="mt-2 font-bold text-tertiary">
              Завершить сезон
            </button>
          )}
          <button onClick={remove} className="mt-2 font-bold text-red-600">
            Удалить посадку
          </button>
```

- [ ] **Step 3: Проверить сборку**

Run: `cd web && npm run build`
Expected: успешная сборка без ошибок.

- [ ] **Step 4: Ручная проверка обоих флоу**

1. На «Сегодня» (веб и Android): открыть карточку «Убрать урожай» у созревшей культуры → форма с преднастроенной посадкой → сохранить без чекбокса → карточка пропадает на 3 дня (на бэкенде: `SELECT harvested_at FROM harvests WHERE planting_id=...` показывает новую запись), посадка остаётся активной.
2. Тот же флоу, но с чекбоксом «Это весь урожай в этом сезоне» включённым → посадка переходит в «Завершённые».
3. На странице посадки (веб): кнопка «Завершить сезон» → подтверждение → посадка архивируется (как в Android).

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/PlantingDetailScreen.tsx
git commit -m "feat(plantings): кнопка «Завершить сезон» на странице посадки (веб, паритет с Android)"
```

---

## Self-review

- **Покрытие спеки:** backend cooldown (Task 1), Android preselect+чекбокс+клик с «Сегодня» (Task 2-3), веб клик с «Сегодня» + чекбокс в журнале + кнопка завершения сезона (Task 4-6) — все пункты разделов 1-3 спеки покрыты.
- **Плейсхолдеров нет** — каждый блок кода исполняемый.
- **Согласованность имён:** `finishSeason`, `preselectedPlanting`, `HARVEST_COOLDOWN_DAYS`, `lastHarvestedMap` — одинаково во всех задачах, где встречаются.
- **Из дальнейшего:** синхронизация snooze/delete между Android и вебом — отдельный follow-up, не входит в этот план (см. спеку).
