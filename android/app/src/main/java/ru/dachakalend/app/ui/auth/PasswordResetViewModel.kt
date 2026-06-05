package ru.dachakalend.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

enum class ResetStep { REQUEST_CODE, ENTER_NEW_PASSWORD }

data class PasswordResetUiState(
    val step: ResetStep = ResetStep.REQUEST_CODE,
    val isLoading: Boolean = false,
    val done: Boolean = false,            // пароль успешно изменён
    val error: String? = null
)

@HiltViewModel
class PasswordResetViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PasswordResetUiState())
    val uiState: StateFlow<PasswordResetUiState> = _uiState.asStateFlow()

    /** Шаг 1: запрос кода на email. Сервер всегда отвечает успехом → переходим к вводу кода. */
    fun requestCode(email: String) {
        if (email.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Введите email")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            _uiState.value = when (val r = authRepository.forgotPassword(email)) {
                is Result.Success -> _uiState.value.copy(isLoading = false, step = ResetStep.ENTER_NEW_PASSWORD)
                is Result.Error   -> _uiState.value.copy(isLoading = false, error = r.message)
                is Result.Loading -> _uiState.value.copy(isLoading = false)
            }
        }
    }

    /** Шаг 2: установка нового пароля по коду. */
    fun resetPassword(email: String, code: String, password: String) {
        if (code.trim().length < 6) {
            _uiState.value = _uiState.value.copy(error = "Введите 6-значный код")
            return
        }
        if (password.length < 6) {
            _uiState.value = _uiState.value.copy(error = "Пароль минимум 6 символов")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            _uiState.value = when (val r = authRepository.resetPassword(email, code, password)) {
                is Result.Success -> _uiState.value.copy(isLoading = false, done = true)
                is Result.Error   -> _uiState.value.copy(isLoading = false, error = r.message)
                is Result.Loading -> _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun backToRequest() {
        _uiState.value = _uiState.value.copy(step = ResetStep.REQUEST_CODE, error = null)
    }
}
