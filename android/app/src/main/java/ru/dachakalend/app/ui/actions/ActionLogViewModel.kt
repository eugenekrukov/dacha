package ru.dachakalend.app.ui.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class ActionLogUiState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null
)

val ACTION_TYPES = listOf(
    "watering"      to "💧 Полив",
    "fertilizing"   to "🌿 Подкормка",
    "treatment"     to "🛡️ Обработка",
    "pricking_out"  to "🪴 Пикировка",
    "transplanting" to "🌱 Высадка",
    "tying"         to "🪢 Подвязка",
    "pinching"      to "✂️ Пасынкование",
    "hilling"       to "⛏️ Окучивание",
    "pruning"       to "🌿 Обрезка",
    "weeding"       to "🌾 Прополка",
    "other"         to "📋 Другое"
)

// Маппинг care_task_name → action_type (должен совпадать с CARE_TASK_ACTION_MAP на бэкенде)
fun careTaskActionType(careTaskName: String?): String = when (careTaskName) {
    "Подвязка"     -> "tying"
    "Пасынкование" -> "pinching"
    "Окучивание"   -> "hilling"
    "Обрезка"      -> "pruning"
    "Прополка"     -> "weeding"
    "Рыхление"     -> "loosening"
    else           -> "other"
}

@HiltViewModel
class ActionLogViewModel @Inject constructor(
    private val actionsRepository: ActionsRepository,
    private val plantingsRepository: PlantingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActionLogUiState())
    val uiState: StateFlow<ActionLogUiState> = _uiState.asStateFlow()

    fun reset() {
        _uiState.value = ActionLogUiState()
    }

    fun logAction(plantingId: Int, type: String, notes: String? = null) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            when (val result = actionsRepository.logAction(plantingId, type, notes)) {
                is Result.Success -> _uiState.value = ActionLogUiState(success = true)
                is Result.Error   -> _uiState.value = ActionLogUiState(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Логирует "Высаживание" и переводит стадию в growing — задача transplant_due исчезнет. */
    fun logTransplanting(plantingId: Int) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            actionsRepository.logAction(plantingId, "transplanting", null)
            when (val result = plantingsRepository.updateStage(plantingId, "growing")) {
                is Result.Success -> _uiState.value = ActionLogUiState(success = true)
                is Result.Error   -> _uiState.value = ActionLogUiState(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }
}
