package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.TodayResponse
import javax.inject.Inject
import javax.inject.Singleton

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

@Singleton
class TodayRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    suspend fun getToday(): Result<TodayResponse> {
        return try {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) return Result.Error("Участок не выбран")
            Result.Success(api.getToday(gardenId))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки")
        }
    }
}
