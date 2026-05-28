package ru.dachakalend.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.TodayResponse
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.data.repository.TodayRepository
import javax.inject.Inject

sealed class TodayUiState {
    object Loading : TodayUiState()
    data class Success(val data: TodayResponse) : TodayUiState()
    data class Error(val message: String) : TodayUiState()
}

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val repository: TodayRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState

    init {
        loadToday()
    }

    fun loadToday() {
        viewModelScope.launch {
            _uiState.value = TodayUiState.Loading
            _uiState.value = when (val result = repository.getToday()) {
                is Result.Success -> TodayUiState.Success(result.data)
                is Result.Error   -> TodayUiState.Error(result.message)
                is Result.Loading -> TodayUiState.Loading
            }
        }
    }
}
