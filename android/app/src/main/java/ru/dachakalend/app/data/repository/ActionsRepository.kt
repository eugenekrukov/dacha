package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CreateActionRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActionsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getActions(plantingId: Int? = null): Result<List<ActionLog>> = try {
        Result.Success(api.getActions(plantingId = plantingId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки действий")
    }

    suspend fun logAction(plantingId: Int, type: String, notes: String? = null): Result<ActionLog> = try {
        Result.Success(api.createAction(CreateActionRequest(plantingId, type, notes)))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка записи действия")
    }
}
