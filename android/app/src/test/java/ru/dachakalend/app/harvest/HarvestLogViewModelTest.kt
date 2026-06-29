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
