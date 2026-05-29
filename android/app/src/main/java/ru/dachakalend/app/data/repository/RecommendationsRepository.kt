package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Recommendation
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecommendationsRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    suspend fun getRecommendations(): Result<List<Recommendation>> {
        return try {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) return Result.Error("Участок не выбран")
            Result.Success(api.getRecommendations(gardenId))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки рекомендаций")
        }
    }
}
