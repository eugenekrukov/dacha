package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Crop
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CropsRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {

    fun getClimateZone(): String? = tokenStorage.getClimateZone()

    suspend fun getCrops(category: String? = null): Result<List<Crop>> = try {
        Result.Success(api.getCrops(category))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки культур")
    }

    suspend fun getCrop(id: Int): Result<Crop> = try {
        Result.Success(api.getCrop(id))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Культура не найдена")
    }
}
