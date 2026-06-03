package ru.dachakalend.app.data.repository

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CreateActionRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActionsRepository @Inject constructor(private val api: DachaApi) {

    private val _deletedActionId = MutableSharedFlow<Int>()
    val deletedActionEvents: SharedFlow<Int> = _deletedActionId.asSharedFlow()

    suspend fun getActions(plantingId: Int? = null): Result<List<ActionLog>> = try {
        Result.Success(api.getActions(plantingId = plantingId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки действий")
    }

    suspend fun logAction(plantingId: Int, type: String, notes: String? = null, auto: Boolean = false): Result<ActionLog> = try {
        Result.Success(api.createAction(CreateActionRequest(plantingId, type, notes, auto)))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка записи действия")
    }

    suspend fun deleteAction(id: Int): Result<Unit> = try {
        api.deleteAction(id)
        _deletedActionId.emit(id)
        Result.Success(Unit)
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка удаления")
    }
}
