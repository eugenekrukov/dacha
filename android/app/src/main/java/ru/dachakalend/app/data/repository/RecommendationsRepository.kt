package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.SeasonWorksResponse
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

    /** «Работы на этой неделе» по сезону участка; скрытые пользователем («Сделано/Не актуально») отфильтрованы. */
    suspend fun getSeasonWorks(): Result<SeasonWorksResponse> {
        return try {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) return Result.Error("Участок не выбран")
            val hidden = tokenStorage.getHiddenSeasonWorks()
            val r = api.getSeasonWorks(gardenId)
            Result.Success(r.copy(items = r.items.filterNot { it.key in hidden }))
        } catch (e: Exception) {
            Result.Error(e.message ?: "Ошибка загрузки сезонных работ")
        }
    }
}
