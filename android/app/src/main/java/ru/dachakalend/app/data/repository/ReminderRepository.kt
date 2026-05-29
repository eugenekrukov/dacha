package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreateReminderRequest
import ru.dachakalend.app.data.model.Reminder
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReminderRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getReminders(): Result<List<Reminder>> = try {
        Result.Success(api.getReminders())
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки напоминаний")
    }

    suspend fun createReminder(request: CreateReminderRequest): Result<Reminder> = try {
        Result.Success(api.createReminder(request))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка создания напоминания")
    }
}
