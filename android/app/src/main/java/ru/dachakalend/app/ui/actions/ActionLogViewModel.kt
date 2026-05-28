package ru.dachakalend.app.ui.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.ActionsRepository
import javax.inject.Inject

data class ActionLogUiState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null
)

val ACTION_TYPES = listOf(
    "watering"    to "💧 Полил",
    "fertilizing" to "🌿 Подкормил",
    "treatment"   to "🛡️ Обработал",
    "other"       to "📋 Другое"
)

@HiltViewModel
class ActionLogViewModel @Inject constructor(
    private val actionsRepository: ActionsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActionLogUiState())
    val uiState: StateFlow<ActionLogUiState> = _uiState.asStateFlow()

    fun logAction(plantingId: Int, type: String, notes: String? = null) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            actionsRepository.logAction(plantingId, type, notes).fold(
                onSuccess = { _uiState.value = ActionLogUiState(success = true) },
                onFailure = { _uiState.value = ActionLogUiState(error = it.message) }
            )
        }
    }
}
