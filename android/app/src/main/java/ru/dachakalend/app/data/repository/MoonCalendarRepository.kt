package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.MoonCalendarResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MoonCalendarRepository @Inject constructor(
    private val api: DachaApi
) {
    suspend fun getMoonCalendar(year: Int, month: Int): Result<MoonCalendarResponse> {
        return try {
            Result.Success(api.getMoonCalendar(year, month))
        } catch (e: Exception) {
            errorResult(e, "Не удалось загрузить лунный календарь")
        }
    }
}
