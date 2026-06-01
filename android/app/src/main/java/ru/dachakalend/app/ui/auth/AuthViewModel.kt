package ru.dachakalend.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    // После логина — есть ли уже участок на сервере
    object SuccessHasGarden : AuthUiState()
    object SuccessNoGarden : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val gardenRepository: GardenRepository   // восстановление gardenId после логина
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Заполните все поля")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            when (val result = authRepository.login(email, password)) {
                is Result.Success -> {
                    // Восстанавливаем gardenId с сервера — иначе после logout все данные теряются
                    gardenRepository.loadGardens()
                    _uiState.value = if (gardenRepository.hasGarden())
                        AuthUiState.SuccessHasGarden
                    else
                        AuthUiState.SuccessNoGarden
                }
                is Result.Error   -> _uiState.value = AuthUiState.Error(result.message)
                is Result.Loading -> _uiState.value = AuthUiState.Loading
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        if (name.isBlank() || email.isBlank() || password.isBlank()) {
            _uiState.value = AuthUiState.Error("Заполните все поля")
            return
        }
        if (password.length < 6) {
            _uiState.value = AuthUiState.Error("Пароль минимум 6 символов")
            return
        }
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            _uiState.value = when (val result = authRepository.register(name, email, password)) {
                is Result.Success -> AuthUiState.SuccessNoGarden // новый пользователь — нет участка
                is Result.Error   -> AuthUiState.Error(result.message)
                is Result.Loading -> AuthUiState.Loading
            }
        }
    }

    fun resetState() { _uiState.value = AuthUiState.Idle }
}
