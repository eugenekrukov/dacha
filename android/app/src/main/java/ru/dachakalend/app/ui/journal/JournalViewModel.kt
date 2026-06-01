package ru.dachakalend.app.ui.journal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class JournalUiState(
    val actions: List<ActionLog> = emptyList(),
    val cropFilter: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
) {
    val allCrops: List<String>
        get() = actions.mapNotNull { it.cropName }.distinct().sorted()

    val filteredActions: List<ActionLog>
        get() = if (cropFilter == null) actions else actions.filter { it.cropName == cropFilter }

    val groupedByDate: Map<String, List<ActionLog>>
        get() = filteredActions.groupBy { it.loggedAt.take(10) }
}

@HiltViewModel
class JournalViewModel @Inject constructor(
    private val actionsRepository: ActionsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(JournalUiState())
    val uiState: StateFlow<JournalUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = actionsRepository.getActions()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    actions = result.data,
                    isLoading = false
                )
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun setCropFilter(crop: String?) {
        _uiState.value = _uiState.value.copy(cropFilter = crop)
    }
}
