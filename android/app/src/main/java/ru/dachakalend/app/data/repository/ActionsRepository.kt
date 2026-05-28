package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CreateActionRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActionsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getActions(plantingId: Int): Result<List<ActionLog>> = runCatching {
        api.getActions(plantingId)
    }

    suspend fun logAction(plantingId: Int, type: String, notes: String? = null): Result<ActionLog> =
        runCatching {
            api.createAction(CreateActionRequest(plantingId, type, notes))
        }
}
