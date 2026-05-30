package ru.dachakalend.app.ui.analytics

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.AnalyticsSummary
import ru.dachakalend.app.data.repository.AnalyticsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class AnalyticsUiState(
    val summary: AnalyticsSummary? = null,
    val isLoading: Boolean = false,
    val isExporting: Boolean = false,
    val error: String? = null,
    val shareIntent: Intent? = null
)

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val analyticsRepository: AnalyticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnalyticsUiState())
    val uiState: StateFlow<AnalyticsUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = analyticsRepository.getSummary()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    summary = result.data,
                    isLoading = false
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = result.message
                )
                is Result.Loading -> Unit
            }
        }
    }

    fun exportActions() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isExporting = true)
            when (val result = analyticsRepository.exportActionsIntent()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    isExporting = false,
                    shareIntent = result.data
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isExporting = false,
                    error = result.message
                )
                is Result.Loading -> Unit
            }
        }
    }

    fun clearShareIntent() {
        _uiState.value = _uiState.value.copy(shareIntent = null)
    }
}
