package ru.dachakalend.app.ui.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.MoonDay
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Reminder
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.repository.CalendarRepository
import ru.dachakalend.app.data.repository.MoonCalendarRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.common.effectivePlanted
import ru.dachakalend.app.ui.common.taskDayOffset
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
    val moonDays: Map<LocalDate, MoonDay> = emptyMap(),
    val error: String? = null
)

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val repository: CalendarRepository,
    private val moonRepository: MoonCalendarRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState

    init {
        load()
        loadMoon(_uiState.value.currentMonth)
    }

    // Фазы Луны зависят от просматриваемого месяца (в отличие от задач — те считаются
    // от сегодняшней даты на 60 дней вперёд и не требуют перезагрузки при смене месяца).
    private fun loadMoon(month: YearMonth) {
        viewModelScope.launch {
            when (val result = moonRepository.getMoonCalendar(month.year, month.monthValue)) {
                is Result.Success -> {
                    val byDate = result.data.days.mapNotNull { day ->
                        runCatching { LocalDate.parse(day.date) to day }.getOrNull()
                    }.toMap()
                    _uiState.value = _uiState.value.copy(moonDays = byDate)
                }
                else -> Unit // не критично для основного календаря — тихо игнорируем
            }
        }
    }

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
        val newMonth = _uiState.value.currentMonth.minusMonths(1)
        _uiState.value = _uiState.value.copy(currentMonth = newMonth, selectedDay = null)
        loadMoon(newMonth)
    }

    fun nextMonth() {
        val newMonth = _uiState.value.currentMonth.plusMonths(1)
        _uiState.value = _uiState.value.copy(currentMonth = newMonth, selectedDay = null)
        loadMoon(newMonth)
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
        // Границы вегетации участка: начало — якорь ухода многолетников, длина — для перевода
        // осенних задач (anchor="end") в отсчёт от начала.
        val seasonStart = tokenStorage.getSeasonStartDoy()
        val seasonEnd = tokenStorage.getSeasonEndDoy()
        val seasonLength = if (seasonStart != null && seasonEnd != null) seasonEnd - seasonStart else null
        val cropsById = crops.associateBy { it.id }
        // Завершённые посадки (сезон закрыт) — их работы/напоминания/отложенные задачи в календаре не показываем.
        val donePlantingIds = plantings.filter { it.stage == "done" }.map { it.id }.toSet()

        // Задачи из /today — на сегодняшнюю дату (кроме привязанных к завершённой посадке)
        todayTasks.forEach { task ->
            if (task.plantingId != null && task.plantingId in donePlantingIds) return@forEach
            val label = when (task.type) {
                "watering_due"    -> "Полив: ${task.cropName ?: ""}"
                "fertilizing_due" -> "Подкормка: ${task.cropName ?: ""}"
                "transplant_due"  -> "Пересадка: ${task.cropName ?: ""}"
                "harvest_due"     -> "Урожай: ${task.cropName ?: ""}"
                "frost_alert"     -> "Угроза заморозков"
                else              -> task.title
            }
            result.getOrPut(today) { mutableListOf() }
                .add(DayEvent(today, label, task.type))
        }

        // Напоминания (кроме привязанных к завершённой посадке)
        reminders.forEach { reminder ->
            if (reminder.plantingId != null && reminder.plantingId in donePlantingIds) return@forEach
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
                        .add(DayEvent(date, "Урожай: $cropName", "harvest"))
                }
            }

            // Уход/полив у многолетника считаем от начала сезона в зоне участка (календарь),
            // а не от даты посадки — иначе «Весенняя обрезка» уезжает в месяц посадки, а у куста,
            // заведённого год назад, календарь вообще пуст. Событие «Посев» выше — по РЕАЛЬНОЙ дате.
            // Зеркало web buildCalendarEvents (api/schedule.ts).
            val realSown = planting.sownAt?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
                ?: return@forEach
            val sown = effectivePlanted(
                realSown, crop?.isPerennial == true, today, seasonStart
            )

            // Полив — по wateringFreqDays. Теплица → поливать ЧАЩЕ (×0.8 к интервалу),
            // единый расчёт с бэкендом (utils/todayLogic.wateringIntervalDays).
            val freqDays = (planting.wateringFreqDays ?: 3).let { base ->
                if (planting.conditions == "greenhouse") Math.max(1, Math.round(base * 0.8).toInt()) else base
            }

            val wateringBase = planting.lastActionAt
                ?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
                ?: sown

            var nextWatering = wateringBase.plusDays(freqDays.toLong())
            while (!nextWatering.isAfter(horizon)) {
                if (!nextWatering.isBefore(today)) {
                    result.getOrPut(nextWatering) { mutableListOf() }
                        .add(DayEvent(nextWatering, "Полив: $cropName", "watering"))
                }
                nextWatering = nextWatering.plusDays(freqDays.toLong())
            }

            // Пересадка/пикировка — из crop.transplantDays
            crop?.transplantDays?.let { days ->
                val date = sown.plusDays(days.toLong())
                if (!date.isBefore(today) && !date.isAfter(horizon)) {
                    result.getOrPut(date) { mutableListOf() }
                        .add(DayEvent(date, "Пересадка: $cropName", "care"))
                }
            }

            // care_tasks — разворачиваем до горизонта
            crop?.careTasks?.forEach { task ->
                // Осенние задачи заданы от конца вегетации — приводим к отсчёту от начала.
                var offset = taskDayOffset(task, seasonLength)
                val limit = crop.harvestDays ?: 180
                // Разовая задача не ограничена limit: осенние работы выходят за harvest_days.
                if (task.repeatDays == null) {
                    val date = sown.plusDays(offset.toLong())
                    if (!date.isBefore(today) && !date.isAfter(horizon)) {
                        result.getOrPut(date) { mutableListOf() }
                            .add(DayEvent(date, "${task.name}: $cropName", "care"))
                    }
                    return@forEach
                }
                while (offset <= limit) {
                    val date = sown.plusDays(offset.toLong())
                    if (!date.isBefore(today) && !date.isAfter(horizon)) {
                        result.getOrPut(date) { mutableListOf() }
                            .add(DayEvent(date, "${task.name}: $cropName", "care"))
                    }
                    offset += task.repeatDays
                    if (date.isAfter(horizon)) break
                }
            }
        }

        return result
    }
}
