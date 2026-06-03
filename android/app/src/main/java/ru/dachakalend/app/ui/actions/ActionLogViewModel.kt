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

// Метки без эмодзи: иконку даёт actionIcon() (Material Icons) — единообразно с журналом.
val ACTION_TYPES = listOf(
    "watering"      to "Полив",
    "fertilizing"   to "Подкормка",
    "treatment"     to "Обработка",
    "pricking_out"  to "Пикировка",
    "transplanting" to "Высадка",
    "tying"         to "Подвязка",
    "pinching"      to "Пасынкование",
    "hilling"       to "Окучивание",
    "pruning"       to "Обрезка",
    "weeding"       to "Прополка",
    "loosening"     to "Рыхление",
    "other"         to "Другое"
)

// Маппинг care_task_name → action_type. По КЛЮЧЕВОМУ СЛОВУ (имена в БД описательные:
// «Первое окучивание», «Обработка от капустной мухи», «Обрезка нижних листьев»).
// Должен совпадать с careTaskActionType() на бэкенде (utils/todayLogic.js).
// Незамапленные имена → "other" (на сервере — null: задача не закрывается этим действием).
fun careTaskActionType(careTaskName: String?): String {
    val n = careTaskName?.lowercase() ?: return "other"
    return when {
        n.contains("подвяз")                        -> "tying"
        n.contains("пасынк") || n.contains("прищип") -> "pinching"
        n.contains("окучив")                        -> "hilling"
        n.contains("обрезк")                        -> "pruning"
        n.contains("прополк")                       -> "weeding"
        n.contains("рыхлен")                        -> "loosening"
        n.contains("обработк") || n.contains("опрыск") -> "treatment"
        else                                         -> "other"
    }
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

    fun logAction(plantingId: Int, type: String, notes: String? = null, auto: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            when (val result = actionsRepository.logAction(plantingId, type, notes, auto)) {
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
