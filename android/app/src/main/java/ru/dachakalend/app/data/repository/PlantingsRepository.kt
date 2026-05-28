package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreatePlantingRequest
import ru.dachakalend.app.data.model.Planting
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlantingsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getPlantings(gardenId: Int? = null): Result<List<Planting>> = runCatching {
        api.getPlantings(gardenId)
    }

    suspend fun createPlanting(request: CreatePlantingRequest): Result<Planting> = runCatching {
        api.createPlanting(request)
    }

    suspend fun updateStage(plantingId: Int, stage: String): Result<Planting> = runCatching {
        api.updatePlantingStage(plantingId, mapOf("stage" to stage))
    }
}
