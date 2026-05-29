package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreateHarvestRequest
import ru.dachakalend.app.data.model.Harvest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HarvestRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getHarvests(gardenId: Int? = null): Result<List<Harvest>> = try {
        Result.Success(api.getHarvests(gardenId))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки урожая")
    }

    suspend fun addHarvest(
        plantingId: Int,
        weightKg: Double?,
        quantity: Int?,
        notes: String?
    ): Result<Harvest> = try {
        Result.Success(
            api.createHarvest(CreateHarvestRequest(plantingId, weightKg, quantity, notes))
        )
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка добавления записи")
    }
}
