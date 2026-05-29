package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreatePlantingRequest
import ru.dachakalend.app.data.model.Planting
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlantingsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getPlantings(gardenId: Int? = null): Result<List<Planting>> = try {
        Result.Success(api.getPlantings(gardenId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки посадок")
    }

    suspend fun createPlanting(request: CreatePlantingRequest): Result<Planting> = try {
        Result.Success(api.createPlanting(request))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка создания посадки")
    }

    suspend fun updateStage(plantingId: Int, stage: String): Result<Planting> = try {
        Result.Success(api.updatePlantingStage(plantingId, mapOf("stage" to stage)))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка обновления стадии")
    }
}
