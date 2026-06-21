package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.FeedResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepository @Inject constructor(
    private val api: DachaApi,
) {
    /** Страница персональной ленты «Мой участок». offset=null → начало. */
    suspend fun getFeed(limit: Int = 30, offset: Int = 0): Result<FeedResponse> = try {
        Result.Success(api.getFeed(limit = limit, offset = offset))
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить ленту")
    }
}
