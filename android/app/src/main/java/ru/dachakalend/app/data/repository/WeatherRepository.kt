package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.WeatherSnapshot
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WeatherRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    suspend fun getWeather(): Result<WeatherSnapshot> {
        return try {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) return Result.Error("Участок не выбран")
            Result.Success(api.getWeather(gardenId))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки погоды")
        }
    }
}
