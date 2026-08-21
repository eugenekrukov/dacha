package ru.dachakalend.app.garden

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
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.garden.OnboardingCropsViewModel

// Регресс на баг из разбора воронки (2026-08-21): онбординг тихо резал посадки сверх
// free-лимита без единого слова пользователю — 10 из 36 пользователей упирались в лимит
// в день регистрации и больше не возвращались, ни разу не увидев предложение оплатить.
@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingCropsViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var cropsRepository: CropsRepository
    private lateinit var plantingsRepository: PlantingsRepository
    private lateinit var tokenStorage: TokenStorage
    private lateinit var viewModel: OnboardingCropsViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        cropsRepository = mockk()
        plantingsRepository = mockk()
        tokenStorage = mockk(relaxed = true)
        coEvery { cropsRepository.getCrops() } returns Result.Success(emptyList())
        every { tokenStorage.getGardenId() } returns 1
        viewModel = OnboardingCropsViewModel(cropsRepository, plantingsRepository, tokenStorage)
        dispatcher.scheduler.advanceUntilIdle()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `часть выбранного превышает free-лимит — считаем пропущенные, не молчим`() = runTest {
        coEvery { plantingsRepository.createPlanting(any()) } returnsMany listOf(
            Result.Success(mockk<Planting>(relaxed = true)),
            Result.Success(mockk<Planting>(relaxed = true)),
            Result.Error("лимит", isSubscriptionRequired = true),
            Result.Error("лимит", isSubscriptionRequired = true)
        )
        listOf(1, 2, 3, 4).forEach { viewModel.toggleCrop(it) }

        viewModel.addSelected()
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(2, viewModel.uiState.value.skippedForPaywall)
        assertTrue(viewModel.uiState.value.done)
    }

    @Test
    fun `всё выбранное создалось — пропущенных нет`() = runTest {
        coEvery { plantingsRepository.createPlanting(any()) } returns Result.Success(mockk<Planting>(relaxed = true))
        viewModel.toggleCrop(1)

        viewModel.addSelected()
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(0, viewModel.uiState.value.skippedForPaywall)
        assertTrue(viewModel.uiState.value.done)
    }
}
