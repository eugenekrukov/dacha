package ru.dachakalend.app.actions

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.actions.ActionLogViewModel
import org.junit.Assert.assertEquals
import ru.dachakalend.app.ui.actions.careTaskActionType

@OptIn(ExperimentalCoroutinesApi::class)
class ActionLogViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: ActionsRepository
    private lateinit var viewModel: ActionLogViewModel

    private fun fakeAction(type: String) = ActionLog(
        id = 1,
        plantingId = 1,
        cropName = "Помидор",
        type = type,
        notes = null,
        loggedAt = "2026-06-01T10:00:00Z"
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        viewModel = ActionLogViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `logAction watering sets success=true`() = runTest {
        coEvery { repository.logAction(any(), any(), any()) } returns
            Result.Success(fakeAction("watering"))

        viewModel.uiState.test {
            awaitItem()  // начальное состояние
            viewModel.logAction(1, "watering")
            awaitItem()  // isLoading=true
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem()
            assertTrue(state.success)
        }
    }

    @Test
    fun `logAction error sets error message`() = runTest {
        coEvery { repository.logAction(any(), any(), any()) } returns
            Result.Error("Нет соединения")

        viewModel.uiState.test {
            awaitItem()
            viewModel.logAction(1, "watering")
            awaitItem()  // isLoading=true
            dispatcher.scheduler.advanceUntilIdle()
            val state = awaitItem()
            assertFalse(state.success)
            assertNotNull(state.error)
        }
    }

    @Test
    fun `logAction sets isLoading=true before request`() = runTest {
        coEvery { repository.logAction(any(), any(), any()) } returns
            Result.Success(fakeAction("fertilizing"))

        viewModel.uiState.test {
            awaitItem()  // начальное
            viewModel.logAction(1, "fertilizing")
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `initial state has no error and not loading`() {
        assertNull(viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isLoading)
        assertFalse(viewModel.uiState.value.success)
    }

    @Test
    fun `careTaskActionType maps new care tasks to closeable action types`() {
        assertEquals("thinning", careTaskActionType("Прореживание (первое)"))
        assertEquals("thinning", careTaskActionType("Нормировка побегов"))
        assertEquals("runner_removal", careTaskActionType("Удаление усов"))
        assertEquals("bolt_removal", careTaskActionType("Удаление стрелок"))
        assertEquals("deflowering", careTaskActionType("Удаление цветоносов"))
        assertEquals("deflowering", careTaskActionType("Удаление увядших цветков"))
        assertEquals("staking", careTaskActionType("Установка опоры"))
        // не должно путаться с обрезкой/прищипкой
        assertEquals("pruning", careTaskActionType("Обрезка для кустистости"))
        assertEquals("other", careTaskActionType("Прекратить полив"))
    }
}
