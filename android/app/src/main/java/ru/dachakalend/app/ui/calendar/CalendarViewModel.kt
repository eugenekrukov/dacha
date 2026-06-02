package ru.dachakalend.app.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Reminder
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.repository.CalendarRepository
import ru.dachakalend.app.data.repository.Result
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

data class DayEvent(
    val date: LocalDate,
    val title: String,
    val type: String   // reminder | harvest | sowing | watering | care
)

data class CalendarUiState(
    val isLoading: Boolean = false,
    val currentMonth: YearMonth = YearMonth.now(),
    val selectedDay: LocalDate? = LocalDate.now(),
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
                    val events = buildEvents(
                        result.data.reminders,
                        result.data.plantings,
                        result.data.crops,
                        result.data.todayTasks
                    )
                    _uiState.value = _uiState.value.copy(isLoading = false, eventsByDay = events)
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
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
        plantings: List<Planting>,
        crops: List<Crop>,
        todayTasks: List<TodayTask> = emptyList()
    ): Map<LocalDate, List<DayEvent>> {
        val result = mutableMapOf<LocalDate, MutableList<DayEvent>>()
        val today = LocalDate.now()
        val horizon = today.plusDays(60)
        val cropsById = crops.associateBy { it.id }

        // Задачи из /today — на сегодняшнюю дату
        todayTasks.forEach { task ->
            val label = when (task.type) {
                "watering_due"    -> "💧 Полив: ${task.cropName ?: ""}"
                "fertilizing_due" -> "🌿 Подкормка: ${task.cropName ?: ""}"
                "transplant_due"  -> "🌱 Пересадка: ${task.cropName ?: ""}"
                "harvest_due"     -> "🌾 Урожай: ${task.cropName ?: ""}"
                "frost_alert"     -> "❄️ Угроза заморозков"
                else              -> task.title
            }
            result.getOrPut(today) { mutableListOf() }
                .add(DayEvent(today, label, task.type))
        }

        // Напоминания
        reminders.forEach { reminder ->
            runCatching {
                val date = LocalDate.parse(reminder.remindAt.take(10))
                result.getOrPut(date) { mutableListOf() }
                    .add(DayEvent(date, reminder.message ?: reminder.type ?: "Напоминание", "reminder"))
            }
        }

        // Посадки
        plantings.filter { it.stage != "done" }.forEach { planting ->
            val cropName = planting.cropName ?: "культура"
            val crop = cropsById[planting.cropId]

            // Дата посева
            planting.sownAt?.let { sownStr ->
                runCatching {
                    val date = LocalDate.parse(sownStr.take(10))
                    result.getOrPut(date) { mutableListOf() }
                        .add(DayEvent(date, "Посев: $cropName", "sowing"))
                }
            }

            // Ожидаемый урожай
            planting.expectedHarvestAt?.let { harvestStr ->
                runCatching {
                    val date = LocalDate.parse(harvestStr.take(10))
                    result.getOrPut(date) { mutableListOf() }
                        .add(DayEvent(date, "🌾 Урожай: $cropName", "harvest"))
                }
            }

            val sown = planting.sownAt?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
                ?: return@forEach

            // Полив — по wateringFreqDays
            val freqDays = planting.wateringFreqDays?.let {
                if (planting.conditions == "greenhouse") (it * 1.3).toInt() else it
            } ?: 3

            val wateringBase = planting.lastActionAt
                ?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
                ?: sown

            var nextWatering = wateringBase.plusDays(freqDays.toLong())
            while (!nextWatering.isAfter(horizon)) {
                if (!nextWatering.isBefore(today)) {
                    result.getOrPut(nextWatering) { mutableListOf() }
                        .add(DayEvent(nextWatering, "💧 Полив: $cropName", "watering"))
                }
                nextWatering = nextWatering.plusDays(freqDays.toLong())
            }

            // Пересадка/пикировка — из crop.transplantDays
            crop?.transplantDays?.let { days ->
                val date = sown.plusDays(days.toLong())
                if (!date.isBefore(today) && !date.isAfter(horizon)) {
                    result.getOrPut(date) { mutableListOf() }
                        .add(DayEvent(date, "🌿 Пересадка: $cropName", "care"))
                }
            }

            // care_tasks — разворачиваем до горизонта
            crop?.careTasks?.forEach { task ->
                var offset = task.dayOffset
                val limit = crop.harvestDays ?: 180
                while (offset <= limit) {
                    val date = sown.plusDays(offset.toLong())
                    if (!date.isBefore(today) && !date.isAfter(horizon)) {
                        result.getOrPut(date) { mutableListOf() }
                            .add(DayEvent(date, "${task.name}: $cropName", "care"))
                    }
                    if (task.repeatDays == null) break
                    offset += task.repeatDays
                    if (date.isAfter(horizon)) break
                }
            }
        }

        return result
    }
}
