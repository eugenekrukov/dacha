package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreatePlantingRequest
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.UpdatePlantingInfoRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlantingsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getPlantings(gardenId: Int? = null): Result<List<Planting>> = try {
        Result.Success(api.getPlantings(gardenId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки посадок")
    }

    suspend fun getPlanting(id: Int): Result<Planting> = try {
        Result.Success(api.getPlanting(id))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки посадки")
    }

    suspend fun createPlanting(request: CreatePlantingRequest): Result<Planting> = try {
        Result.Success(api.createPlanting(request))
    } catch (e: Exception) {
        // 402 здесь — free-лимит посадок (plan_limit_reached) либо истёкшая подписка;
        // errorResult даёт понятное сообщение вместо сырого текста исключения.
        errorResult(e, "Ошибка создания посадки")
    }

    suspend fun updateStage(plantingId: Int, stage: String): Result<Planting> = try {
        Result.Success(api.updatePlantingStage(plantingId, mapOf("stage" to stage)))
    } catch (e: Exception) {
        errorResult(e, "Ошибка смены стадии")
    }

    suspend fun updateInfo(plantingId: Int, request: UpdatePlantingInfoRequest): Result<Planting> = try {
        Result.Success(api.updatePlantingInfo(plantingId, request))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка обновления посадки")
    }

    suspend fun deletePlanting(plantingId: Int): Result<Unit> = try {
        api.deletePlanting(plantingId)
        Result.Success(Unit)
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка удаления посадки")
    }
}
