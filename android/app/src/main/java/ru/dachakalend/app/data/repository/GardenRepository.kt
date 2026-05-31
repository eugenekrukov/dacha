package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.CreateGardenRequest
import ru.dachakalend.app.data.model.Garden
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GardenRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    fun hasGarden(): Boolean = tokenStorage.getGardenId() != -1

    suspend fun loadGardens(): Result<List<Garden>> {
        return try {
            val gardens = api.getGardens()
            if (gardens.isNotEmpty()) {
                tokenStorage.saveGardenId(gardens.first().id)
                tokenStorage.saveClimateZone(gardens.first().climateZone)
            }
            Result.Success(gardens)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки участков")
        }
    }

    suspend fun createGarden(name: String, region: String, city: String? = null): Result<Garden> {
        return try {
            val garden = api.createGarden(
                CreateGardenRequest(
                    name = name,
                    region = region,
                    city = city?.ifBlank { null },
                    soilType = null,
                    climateZone = null
                )
            )
            tokenStorage.saveGardenId(garden.id)
            Result.Success(garden)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка создания участка")
        }
    }
}
