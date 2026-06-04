package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.LoginRequest
import ru.dachakalend.app.data.model.RegisterRequest
import ru.dachakalend.app.data.model.PromoRedeemResponse
import ru.dachakalend.app.data.model.UserProfile
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: DachaApi,
    private val tokenStorage: TokenStorage
) {
    fun isLoggedIn(): Boolean = tokenStorage.getToken() != null

    suspend fun login(email: String, password: String): Result<UserProfile> {
        return try {
            val response = api.login(LoginRequest(email, password))
            tokenStorage.saveToken(response.token)
            Result.Success(response.user)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    suspend fun register(email: String, password: String): Result<UserProfile> {
        return try {
            val response = api.register(RegisterRequest(email, password))
            tokenStorage.saveToken(response.token)
            Result.Success(response.user)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    /** Профиль текущего пользователя с серверным статусом триала. */
    suspend fun me(): Result<UserProfile> {
        return try {
            Result.Success(api.getMe())
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    /** Синхронизирует статус подписки на сервер (best-effort, не валит вызывающего). */
    suspend fun syncSubscription(active: Boolean) {
        try { api.syncSubscription(mapOf("active" to active)) } catch (_: Exception) {}
    }

    /** Погашает промокод. Сервер выдаёт промо-доступ и возвращает его статус. */
    suspend fun redeemPromo(code: String): Result<PromoRedeemResponse> {
        return try {
            Result.Success(api.redeemPromo(mapOf("code" to code)))
        } catch (e: Exception) {
            Result.Error(parsePromoError(e))
        }
    }

    private fun parsePromoError(e: Exception): String = when {
        e.message?.contains("404") == true -> "Промокод не найден"
        e.message?.contains("409") == true -> "Промокод уже использован"
        e.message?.contains("410") == true -> "Срок действия промокода истёк"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> "Не удалось активировать промокод"
    }

    fun logout() = tokenStorage.clearToken()

    private fun parseError(e: Exception): String = when {
        e.message?.contains("401") == true -> "Неверный email или пароль"
        e.message?.contains("409") == true -> "Пользователь с таким email уже существует"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> e.message ?: "Неизвестная ошибка"
    }
}
