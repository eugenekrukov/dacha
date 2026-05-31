package ru.dachakalend.app.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Reminder
import ru.dachakalend.app.data.repository.CalendarRepository
import ru.dachakalend.app.data.repository.Result
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

data class DayEvent(
    val date: LocalDate,
    val title: String,
    val type: String   // reminder | harvest | sowing
)

data class CalendarUiState(
    val isLoading: Boolean = false,
    val currentMonth: YearMonth = YearMonth.now(),
    val selectedDay: LocalDate? = null,
    val eventsByDay: Map<LocalDate, List<DayEvent>> = emptyMap(),
    val error: String? = null
)

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val repository: CalendarRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = repository.getCalendarData()) {
                is Result.Success -> {
                    val events = buildEvents(result.data.reminders, result.data.plantings)
                    _uiState.value = _uiState.value.copy(isLoading = false, eventsByDay = events)
                }
                is Result.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
                is Result.Loading -> Unit
            }
        }
    }

    fun selectDay(day: LocalDate) {
        _uiState.value = _uiState.value.copy(
            selectedDay = if (_uiState.value.selectedDay == day) null else day
        )
    }

    fun previousMonth() {
        _uiState.value = _uiState.value.copy(
            currentMonth = _uiState.value.currentMonth.minusMonths(1),
            selectedDay = null
        )
    }

    fun nextMonth() {
        _uiState.value = _uiState.value.copy(
            currentMonth = _uiState.value.currentMonth.plusMonths(1),
            selectedDay = null
        )
    }

    private fun buildEvents(
        reminders: List<Reminder>,
        plantings: List<Planting>
    ): Map<LocalDate, List<DayEvent>> {
        val result = mutableMapOf<LocalDate, MutableList<DayEvent>>()

        // Напоминания
        reminders.forEach { reminder ->
            runCatching {
                val date = LocalDate.parse(reminder.remindAt.take(10))
                result.getOrPut(date) { mutableListOf() }.add(
                    DayEvent(date, reminder.message ?: reminder.type ?: "Напоминание", "reminder")
                )
            }
        }

        // Ожидаемая дата урожая
        plantings.forEach { planting ->
            planting.expectedHarvestAt?.let { harvestDate ->
                runCatching {
                    val date = LocalDate.parse(harvestDate.take(10))
                    result.getOrPut(date) { mutableListOf() }.add(
                        DayEvent(date, "Урожай: ${planting.cropName ?: "культура"}", "harvest")
                    )
                }
            }
            // Дата посева
            planting.sownAt?.let { sownDate ->
                runCatching {
                    val date = LocalDate.parse(sownDate.take(10))
                    result.getOrPut(date) { mutableListOf() }.add(
                        DayEvent(date, "Посев: ${planting.cropName ?: "культура"}", "sowing")
                    )
                }
            }
        }

        return result
    }
}
