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

        every { tokenStorage.getGardenId() }    returns 1
        every { tokenStorage.getClimateZone() } returns "4"
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = TodayViewModel(
        todayRepo, recsRepo, plantingsRepo, gardenRepo, actionsRepo, tokenStorage, api
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
}
