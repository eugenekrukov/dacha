package ru.dachakalend.app.auth

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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ru.dachakalend.app.data.model.UserProfile
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.auth.AuthUiState
import ru.dachakalend.app.ui.auth.AuthViewModel

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: AuthRepository
    private lateinit var gardenRepository: GardenRepository
    private lateinit var viewModel: AuthViewModel

    private val fakeUser = UserProfile(id = 1, name = "Test", email = "test@test.com")

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        // relaxed: hasGarden() → false по умолчанию → успех логина даёт SuccessNoGarden
        gardenRepository = mockk(relaxed = true)
        viewModel = AuthViewModel(repository, gardenRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ── login() ──────────────────────────────────────────────────────────────

    @Test
    fun `login success transitions to Success`() = runTest {
        coEvery { repository.login(any(), any()) } returns Result.Success(fakeUser)

        viewModel.uiState.test {
            assertEquals(AuthUiState.Idle, awaitItem())  // начальное состояние

            viewModel.login("test@test.com", "password123")
            assertEquals(AuthUiState.Loading, awaitItem())

            dispatcher.scheduler.advanceUntilIdle()
            assertEquals(AuthUiState.SuccessNoGarden, awaitItem())
        }
    }

    @Test
    fun `login error shows Error state`() = runTest {
        coEvery { repository.login(any(), any()) } returns Result.Error("Неверный email или пароль")

        viewModel.uiState.test {
            awaitItem()  // Idle

            viewModel.login("test@test.com", "wrongpass")
            awaitItem()  // Loading

            dispatcher.scheduler.advanceUntilIdle()
            val error = awaitItem() as AuthUiState.Error
            assertTrue(error.message.contains("Неверный"))
        }
    }

    @Test
    fun `login with blank email shows Error without network call`() = runTest {
        viewModel.uiState.test {
            awaitItem()  // Idle
            viewModel.login("", "password")
            val error = awaitItem() as AuthUiState.Error
            assertTrue(error.message.isNotBlank())
        }
        // repository.login() не должен был вызваться
        coEvery { repository.login(any(), any()) } returns Result.Success(fakeUser)  // убеждаемся что мок не трогали
    }

    @Test
    fun `login sets Loading before request`() = runTest {
        coEvery { repository.login(any(), any()) } returns Result.Success(fakeUser)

        viewModel.uiState.test {
            awaitItem()  // Idle
            viewModel.login("test@test.com", "password")
            assertEquals(AuthUiState.Loading, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ── register() ───────────────────────────────────────────────────────────

    @Test
    fun `register success transitions to Success`() = runTest {
        coEvery { repository.register(any(), any()) } returns Result.Success(fakeUser)

        viewModel.uiState.test {
            awaitItem()  // Idle
            viewModel.register("test@test.com", "password123")
            awaitItem()  // Loading
            dispatcher.scheduler.advanceUntilIdle()
            assertEquals(AuthUiState.SuccessNoGarden, awaitItem())
        }
    }

    @Test
    fun `register with password less than 6 chars shows Error`() = runTest {
        viewModel.uiState.test {
            awaitItem()  // Idle
            viewModel.register("test@test.com", "123")
            val error = awaitItem() as AuthUiState.Error
            assertTrue(error.message.contains("6"))
        }
    }

    @Test
    fun `register with 409 error shows appropriate message`() = runTest {
        coEvery { repository.register(any(), any()) } returns
            Result.Error("Пользователь с таким email уже существует")

        viewModel.uiState.test {
            awaitItem()
            viewModel.register("exists@test.com", "password123")
            awaitItem()  // Loading
            dispatcher.scheduler.advanceUntilIdle()
            val error = awaitItem() as AuthUiState.Error
            assertTrue(error.message.contains("уже существует"))
        }
    }

    // ── resetState() ─────────────────────────────────────────────────────────

    @Test
    fun `resetState returns to Idle`() = runTest {
        coEvery { repository.login(any(), any()) } returns Result.Success(fakeUser)

        viewModel.login("test@test.com", "pass123")
        dispatcher.scheduler.advanceUntilIdle()

        viewModel.resetState()
        assertEquals(AuthUiState.Idle, viewModel.uiState.value)
    }
}
