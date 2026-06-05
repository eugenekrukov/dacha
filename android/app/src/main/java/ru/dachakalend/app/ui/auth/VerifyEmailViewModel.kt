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

data class VerifyEmailUiState(
    val isLoading: Boolean = false,
    val verified: Boolean = false,
    val error: String? = null,
    val resentMessage: String? = null
)

@HiltViewModel
class VerifyEmailViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(VerifyEmailUiState())
    val uiState: StateFlow<VerifyEmailUiState> = _uiState.asStateFlow()

    fun verify(code: String) {
        if (code.trim().length < 6) {
            _uiState.value = _uiState.value.copy(error = "Введите 6-значный код")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, resentMessage = null)
            _uiState.value = when (val r = authRepository.verifyEmail(code)) {
                is Result.Success -> _uiState.value.copy(isLoading = false, verified = true)
                is Result.Error   -> _uiState.value.copy(isLoading = false, error = r.message)
                is Result.Loading -> _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun resend() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(error = null, resentMessage = null)
            when (authRepository.resendVerification()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(resentMessage = "Код отправлен повторно")
                is Result.Error   -> _uiState.value = _uiState.value.copy(resentMessage = "Код отправлен повторно")
                is Result.Loading -> Unit
            }
        }
    }
}
