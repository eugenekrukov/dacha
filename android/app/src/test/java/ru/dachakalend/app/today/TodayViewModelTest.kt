package ru.dachakalend.app.today

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.TodayResponse
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.RecommendationsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.data.repository.TodayRepository
import ru.dachakalend.app.ui.today.TodayUiState
import ru.dachakalend.app.ui.today.TodayViewModel
import ru.dachakalend.app.ui.today.taskClosedBy

@OptIn(ExperimentalCoroutinesApi::class)
class TodayViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private lateinit var todayRepo: TodayRepository
    private lateinit var recsRepo: RecommendationsRepository
    private lateinit var plantingsRepo: PlantingsRepository
    private lateinit var gardenRepo: GardenRepository
    private lateinit var actionsRepo: ActionsRepository
    private lateinit var tokenStorage: TokenStorage
    private lateinit var api: DachaApi
    private lateinit var todayCache: ru.dachakalend.app.data.local.TodayCache
    private lateinit var syncManager: ru.dachakalend.app.data.sync.ActionSyncManager
    private lateinit var actionQueue: ru.dachakalend.app.data.local.ActionQueue

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        todayRepo     = mockk()
        recsRepo      = mockk()
        plantingsRepo = mockk()
        gardenRepo    = mockk(relaxed = true)
        actionsRepo   = mockk(relaxed = true)
        // relaxed: прочие save*/get*-вызовы кэша возвращают пустые значения по умолчанию
        tokenStorage  = mockk(relaxed = true)
        api           = mockk(relaxed = true)
        todayCache    = mockk(relaxed = true)
        syncManager   = mockk(relaxed = true)
        actionQueue   = mockk(relaxed = true)
        every { actionQueue.size } returns kotlinx.coroutines.flow.MutableStateFlow(0)
        // relaxed-мок ActionsRepository не умеет синтезировать SharedFlow<T> (generic) — без явного
        // стаба .collect() на этих свойствах бросает KotlinNothingValueException (известный гочи MockK).
        every { actionsRepo.deletedActionEvents } returns kotlinx.coroutines.flow.MutableSharedFlow()
        every { actionsRepo.loggedActionEvents }  returns kotlinx.coroutines.flow.MutableSharedFlow()

        every { tokenStorage.getGardenId() }    returns 1
        every { tokenStorage.getClimateZone() } returns "4"
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = TodayViewModel(
        todayRepo, recsRepo, plantingsRepo, gardenRepo, actionsRepo, tokenStorage, api, todayCache, syncManager, actionQueue
    )

    // ── Базовые состояния ─────────────────────────────────────────────────────

    @Test
    fun `initial state is Loading`() {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        val vm = buildViewModel()
        assertEquals(TodayUiState.Loading, vm.uiState.value)
    }

    @Test
    fun `loadToday success sets Success state with data`() = runTest {
        val fakeToday = TodayResponse(gardenId = 1, tasks = emptyList())
        coEvery { todayRepo.getToday() }                returns Result.Success(fakeToday)
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        buildViewModel().uiState.test {
            awaitItem()  // Loading (из init)
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Success
            assertEquals(1, state.data.today.gardenId)
        }
    }

    @Test
    fun `loadToday today error sets Error state`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Error("Нет сети")
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        buildViewModel().uiState.test {
            awaitItem()  // Loading
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Error
            assertTrue(state.message.contains("Нет сети"))
        }
    }

    @Test
    fun `loadToday recs error still shows Success (recs are optional)`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Error("Ошибка")
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        buildViewModel().uiState.test {
            awaitItem()  // Loading
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Success
            assertTrue(state.data.recommendations.isEmpty())
        }
    }

    @Test
    fun `loadToday includes plantings in Success state`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        buildViewModel().uiState.test {
            awaitItem()
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Success
            assertTrue(state.data.plantings.isEmpty())
        }
    }

    @Test
    fun `loadToday sets Loading before requests`() = runTest {
        coEvery { todayRepo.getToday() }                returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }       returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) }   returns Result.Success(emptyList())

        buildViewModel().uiState.test {
            assertEquals(TodayUiState.Loading, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ── F1: офлайн-фолбэк из кэша ──────────────────────────────────────────────

    @Test
    fun `сетевая ошибка с кэшем показывает офлайн-Success`() = runTest {
        coEvery { todayRepo.getToday() }              returns Result.Error("offline", isNetwork = true)
        coEvery { recsRepo.getRecommendations() }     returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) } returns Result.Success(emptyList())
        every { todayCache.load(1) } returns ru.dachakalend.app.data.local.CachedToday(
            gardenId = 1, cachedAt = 123L,
            today = TodayResponse(gardenId = 1), recommendations = emptyList(),
            plantings = emptyList(), todayActions = emptyList(),
        )

        buildViewModel().uiState.test {
            awaitItem() // Loading
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Success
            assertTrue(state.data.offline)
            assertEquals(123L, state.data.cachedAt)
        }
    }

    @Test
    fun `сетевая ошибка без кэша остаётся Error`() = runTest {
        coEvery { todayRepo.getToday() }              returns Result.Error("offline", isNetwork = true)
        coEvery { recsRepo.getRecommendations() }     returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) } returns Result.Success(emptyList())
        every { todayCache.load(any()) } returns null

        buildViewModel().uiState.test {
            awaitItem()
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem() as TodayUiState.Error
            assertTrue(state.message.contains("offline"))
        }
    }

    // ── taskClosedBy: офлайн-снуз после логирования действия ──────────────────
    // Баг: полив посадки из карточки не закрывал ГРУППОВУЮ задачу «Полить: X, Y и ещё N»
    // (planting_id=null у группы, id — только в plantingIds), потому что сверялись только
    // с одиночным plantingId.

    private fun groupedWateringTask(ids: List<Int>) = ru.dachakalend.app.data.model.TodayTask(
        type = "watering_due", priority = 4, title = "Полить: …", description = "",
        plantingId = null, cropName = null, daysOverdue = 5, plantingIds = ids,
    )

    private fun singleTask(type: String, plantingId: Int, careTaskName: String? = null) =
        ru.dachakalend.app.data.model.TodayTask(
            type = type, priority = 4, title = "", description = "",
            plantingId = plantingId, cropName = "Огурец", daysOverdue = 5, careTaskName = careTaskName,
        )

    @Test
    fun `taskClosedBy закрывает групповую задачу поливом одной из посадок`() {
        val task = groupedWateringTask(listOf(31, 35, 32))
        val info = ru.dachakalend.app.data.repository.LoggedActionInfo(plantingId = 35, type = "watering")
        assertTrue(taskClosedBy(task, info))
    }

    @Test
    fun `taskClosedBy не закрывает групповую задачу для чужой посадки`() {
        val task = groupedWateringTask(listOf(31, 35, 32))
        val info = ru.dachakalend.app.data.repository.LoggedActionInfo(plantingId = 99, type = "watering")
        assertTrue(!taskClosedBy(task, info))
    }

    @Test
    fun `taskClosedBy не закрывает задачу действием другого типа`() {
        val task = singleTask("fertilizing_due", plantingId = 31)
        val info = ru.dachakalend.app.data.repository.LoggedActionInfo(plantingId = 31, type = "watering")
        assertTrue(!taskClosedBy(task, info))
    }

    @Test
    fun `taskClosedBy закрывает одиночную задачу полива`() {
        val task = singleTask("watering_due", plantingId = 31)
        val info = ru.dachakalend.app.data.repository.LoggedActionInfo(plantingId = 31, type = "watering")
        assertTrue(taskClosedBy(task, info))
    }

    @Test
    fun `taskClosedBy закрывает care_task_due по совпадающему типу действия`() {
        val task = singleTask("care_task_due", plantingId = 31, careTaskName = "Подкормка золой")
        val info = ru.dachakalend.app.data.repository.LoggedActionInfo(plantingId = 31, type = "fertilizing")
        assertTrue(taskClosedBy(task, info))
    }

    // ── Снуз/удаление задачи дня: состояние на сервере, локально — только оптимизм ─────

    private fun stubEmptyLoad() {
        coEvery { todayRepo.getToday() }              returns Result.Success(TodayResponse())
        coEvery { recsRepo.getRecommendations() }     returns Result.Success(emptyList())
        coEvery { plantingsRepo.getPlantings(any()) } returns Result.Success(emptyList())
        coEvery { api.getDismissedTaskKeys() } returns
            ru.dachakalend.app.data.model.DismissedTasksResponse(emptyList())
    }

    @Test
    fun `snoozeTask прячет карточку и шлёт дисмиссал на сервер`() = runTest {
        stubEmptyLoad()
        coEvery { api.dismissTask(any()) } returns Unit
        val vm = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.snoozeTask("watering_due:1:Помидор:null")
        assertTrue("watering_due:1:Помидор:null" in vm.pendingHiddenTasks.value)
        dispatcher.scheduler.advanceUntilIdle()

        io.mockk.coVerify {
            api.dismissTask(mapOf("task_key" to "watering_due:1:Помидор:null", "action" to "snooze"))
        }
        // Запрос прошёл — карточка остаётся скрытой до следующего ответа сервера
        // (в нём её уже не будет: GET /today фильтрует дисмиссалы).
        assertTrue("watering_due:1:Помидор:null" in vm.pendingHiddenTasks.value)
    }

    @Test
    fun `deleteTask шлёт action=delete`() = runTest {
        stubEmptyLoad()
        coEvery { api.dismissTask(any()) } returns Unit
        val vm = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.deleteTask("harvest_due:2:Огурец:null")
        dispatcher.scheduler.advanceUntilIdle()

        io.mockk.coVerify {
            api.dismissTask(mapOf("task_key" to "harvest_due:2:Огурец:null", "action" to "delete"))
        }
    }

    @Test
    fun `ошибка дисмиссала возвращает карточку`() = runTest {
        stubEmptyLoad()
        coEvery { api.dismissTask(any()) } throws RuntimeException("нет сети")
        // Ответ уходит в офлайн-ветку: без кэша состояние Error, карточка не скрыта
        every { todayCache.load(any()) } returns null
        val vm = buildViewModel()
        dispatcher.scheduler.advanceUntilIdle()

        vm.snoozeTask("watering_due:1:Помидор:null")
        assertTrue("watering_due:1:Помидор:null" in vm.pendingHiddenTasks.value)
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(vm.pendingHiddenTasks.value.isEmpty())
    }
}
