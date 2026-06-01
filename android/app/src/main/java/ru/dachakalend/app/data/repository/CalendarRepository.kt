package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Reminder
import ru.dachakalend.app.data.model.TodayTask
import javax.inject.Inject
import javax.inject.Singleton

data class CalendarData(
    val reminders: List<Reminder>,
    val plantings: List<Planting>,
    val crops: List<Crop> = emptyList(),
    val todayTasks: List<TodayTask> = emptyList()
)

@Singleton
class CalendarRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    suspend fun getCalendarData(): Result<CalendarData> {
        return try {
            val reminders  = try { api.getReminders() } catch (_: Exception) { emptyList() }
            val plantings  = try { api.getPlantings() } catch (_: Exception) { emptyList() }
            val crops      = try { api.getCrops() } catch (_: Exception) { emptyList() }
            val todayTasks = try {
                val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
                if (gardenId != null) api.getToday(gardenId).tasks else emptyList()
            } catch (_: Exception) { emptyList<TodayTask>() }
            Result.Success(CalendarData(reminders, plantings, crops, todayTasks))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки календаря")
        }
    }
}
