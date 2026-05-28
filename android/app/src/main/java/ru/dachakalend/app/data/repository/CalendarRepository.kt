package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Reminder
import javax.inject.Inject
import javax.inject.Singleton

data class CalendarData(
    val reminders: List<Reminder>,
    val plantings: List<Planting>
)

@Singleton
class CalendarRepository @Inject constructor(
    private val api: DachaApi
) {
    suspend fun getCalendarData(): Result<CalendarData> {
        return try {
            val reminders = try { api.getReminders() } catch (e: Exception) { emptyList() }
            val plantings = try { api.getPlantings() } catch (e: Exception) { emptyList() }
            Result.Success(CalendarData(reminders, plantings))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки календаря")
        }
    }
}
