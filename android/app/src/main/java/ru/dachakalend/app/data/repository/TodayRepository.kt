package ru.dachakalend.app.data.repository

import retrofit2.HttpException
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.TodayResponse
import javax.inject.Inject
import javax.inject.Singleton

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(
        val message: String,
        val isNetwork: Boolean = false,
        val isSubscriptionRequired: Boolean = false,
    ) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

const val SUBSCRIPTION_REQUIRED_MESSAGE =
    "Бесплатно доступны 1 сад и до 3 посадок одновременно. Оформите «Дачник Про» для безлимита."

/** Классификация исключения: отсутствие связи (IOException) → isNetwork=true; HTTP 402 → isSubscriptionRequired=true. */
fun errorResult(e: Throwable, fallback: String): Result.Error =
    if (e is HttpException && e.code() == 402) {
        Result.Error(SUBSCRIPTION_REQUIRED_MESSAGE, isSubscriptionRequired = true)
    } else {
        Result.Error(e.message ?: fallback, isNetwork = e is java.io.IOException)
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
            errorResult(e, "Ошибка загрузки")
        }
    }
}
