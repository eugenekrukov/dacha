package ru.dachakalend.app.data.repository

import retrofit2.HttpException
import ru.dachakalend.app.BuildConfig
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.LoginRequest
import ru.dachakalend.app.data.model.RegisterRequest
import ru.dachakalend.app.data.model.PromoRedeemResponse
import ru.dachakalend.app.data.model.UserProfile
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

// HTTP-код ответа, если исключение — HttpException; иначе null. Раньше код доставали
// строковым поиском по e.message (например, .contains("401")) — хрупко к изменению
// формата исключения в Retrofit/OkHttp.
private fun httpCode(e: Throwable): Int? = (e as? HttpException)?.code()

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

    private fun parsePromoError(e: Exception): String {
        val code = httpCode(e)
        return when {
            code == 404 -> "Промокод не найден"
            code == 409 -> "Промокод уже использован"
            code == 410 -> "Срок действия промокода истёк"
            e is IOException -> "Нет соединения с сервером"
            else -> "Не удалось активировать промокод"
        }
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

    private fun parseCodeError(e: Exception): String {
        val code = httpCode(e)
        return when {
            code == 400 -> "Неверный или просроченный код"
            e is IOException -> "Нет соединения с сервером"
            else -> "Не удалось проверить код"
        }
    }

    /** Смена пароля залогиненным пользователем (нужен текущий). */
    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Unit> {
        return try {
            api.changePassword(mapOf("current_password" to currentPassword, "new_password" to newPassword))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parsePasswordError(e))
        }
    }

    /** Смена email — шаг 1: проверка пароля + код на новый адрес. */
    suspend fun changeEmail(newEmail: String, password: String): Result<Unit> {
        return try {
            api.changeEmail(mapOf("new_email" to newEmail.trim(), "password" to password))
            Result.Success(Unit)
        } catch (e: Exception) {
            val code = httpCode(e)
            Result.Error(
                when {
                    code == 401 -> "Неверный пароль"
                    code == 409 -> "Этот email уже занят"
                    e is IOException -> "Нет соединения с сервером"
                    else -> "Не удалось отправить код"
                }
            )
        }
    }

    /** Смена email — шаг 2: подтверждение кода. */
    suspend fun confirmEmailChange(code: String): Result<Unit> {
        return try {
            api.confirmEmailChange(mapOf("code" to code.trim()))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(
                when (httpCode(e)) {
                    409 -> "Этот email уже занят"
                    else -> "Неверный или просроченный код"
                }
            )
        }
    }

    /** Удаляет аккаунт (требует пароль). После успеха вызывающий делает logout. */
    suspend fun deleteAccount(password: String): Result<Unit> {
        return try {
            api.deleteAccount(mapOf("password" to password))
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parsePasswordError(e))
        }
    }

    private fun parsePasswordError(e: Exception): String {
        val code = httpCode(e)
        return when {
            code == 401 -> "Неверный пароль"
            e is IOException -> "Нет соединения с сервером"
            else -> "Не удалось выполнить операцию"
        }
    }

    fun logout() = tokenStorage.clearToken()

    private fun parseError(e: Exception): String {
        val code = httpCode(e)
        return when {
            code == 401 -> "Неверный email или пароль"
            code == 409 -> "Пользователь с таким email уже существует"
            e is IOException -> "Нет соединения с сервером"
            else -> e.message ?: "Неизвестная ошибка"
        }
    }
}
