package ru.dachakalend.app.ui.mooncalendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.MoonDay
import ru.dachakalend.app.data.repository.MoonCalendarRepository
import ru.dachakalend.app.data.repository.Result
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

data class MoonCalendarUiState(
    val isLoading: Boolean = false,
    val currentMonth: YearMonth = YearMonth.now(),
    val days: List<MoonDay> = emptyList(),
    val selectedDate: String = LocalDate.now().toString(),
    val error: String? = null
)

@HiltViewModel
class MoonCalendarViewModel @Inject constructor(
    private val repository: MoonCalendarRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MoonCalendarUiState())
    val uiState: StateFlow<MoonCalendarUiState> = _uiState

    init { load() }

    private fun load() {
        val month = _uiState.value.currentMonth
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = repository.getMoonCalendar(month.year, month.monthValue)) {
                is Result.Success -> {
                    val today = LocalDate.now().toString()
                    val selected = if (result.data.days.any { it.date == today }) today
                                   else result.data.days.firstOrNull()?.date ?: today
                    _uiState.value = _uiState.value.copy(isLoading = false, days = result.data.days, selectedDate = selected)
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun selectDay(date: String) {
        _uiState.value = _uiState.value.copy(selectedDate = date)
    }

    fun previousMonth() {
        _uiState.value = _uiState.value.copy(currentMonth = _uiState.value.currentMonth.minusMonths(1))
        load()
    }

    fun nextMonth() {
        _uiState.value = _uiState.value.copy(currentMonth = _uiState.value.currentMonth.plusMonths(1))
        load()
    }
}
