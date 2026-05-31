package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.CreateGardenRequest
import ru.dachakalend.app.data.model.UpdateGardenRequest
import ru.dachakalend.app.data.model.Garden
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GardenRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    fun hasGarden(): Boolean = tokenStorage.getGardenId() != -1

    fun getCurrentGardenId(): Int = tokenStorage.getGardenId()

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
            tokenStorage.saveClimateZone(garden.climateZone)
            Result.Success(garden)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка создания участка")
        }
    }

    suspend fun updateGarden(
        id: Int,
        name: String,
        region: String,
        city: String? = null
    ): Result<Garden> {
        return try {
            val garden = api.updateGarden(
                id = id,
                request = UpdateGardenRequest(
                    name = name,
                    region = region,
                    city = city?.ifBlank { null }
                )
            )
            tokenStorage.saveClimateZone(garden.climateZone)
            Result.Success(garden)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка сохранения участка")
        }
    }
}
