package ru.dachakalend.app.data.repository

import ru.dachakalend.app.BuildConfig
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
            val response = api.login(LoginRequest(email, password, BuildConfig.STORE))
            tokenStorage.saveToken(response.token)
            Result.Success(response.user)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    suspend fun register(email: String, password: String): Result<UserProfile> {
        return try {
            val response = api.register(RegisterRequest(email, password, BuildConfig.STORE))
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

    /** Подтверждает email кодом из письма. */
    suspend fun verifyEmail(code: String): Result<Unit> {
        return try {
            api.verifyEmail(mapOf("code" to code.trim()))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parseCodeError(e))
        }
    }

    /** Повторно запрашивает код подтверждения email (best-effort). */
    suspend fun resendVerification(): Result<Unit> {
        return try {
            api.resendVerification()
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    /** Запрашивает код для сброса пароля. Сервер всегда отвечает успехом (не раскрывает email). */
    suspend fun forgotPassword(email: String): Result<Unit> {
        return try {
            api.forgotPassword(mapOf("email" to email.trim()))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    /** Устанавливает новый пароль по коду из письма. */
    suspend fun resetPassword(email: String, code: String, password: String): Result<Unit> {
        return try {
            api.resetPassword(mapOf("email" to email.trim(), "code" to code.trim(), "password" to password))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parseCodeError(e))
        }
    }

    private fun parseCodeError(e: Exception): String = when {
        e.message?.contains("400") == true -> "Неверный или просроченный код"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> "Не удалось проверить код"
    }

    fun logout() = tokenStorage.clearToken()

    private fun parseError(e: Exception): String = when {
        e.message?.contains("401") == true -> "Неверный email или пароль"
        e.message?.contains("409") == true -> "Пользователь с таким email уже существует"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> e.message ?: "Неизвестная ошибка"
    }
}
