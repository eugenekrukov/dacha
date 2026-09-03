package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.BlogFeedResponse
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BlogRepository @Inject constructor(
    private val api: DachaApi
) {
    suspend fun getBlogFeed(limit: Int = 20, offset: Int = 0): Result<BlogFeedResponse> = try {
        Result.Success(api.getBlogFeed(limit, offset))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Не удалось загрузить статьи")
    }
}
