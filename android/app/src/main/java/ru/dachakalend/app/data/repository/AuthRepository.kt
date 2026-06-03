package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.LoginRequest
import ru.dachakalend.app.data.model.RegisterRequest
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

    suspend fun register(name: String, email: String, password: String): Result<UserProfile> {
        return try {
            val response = api.register(RegisterRequest(name, email, password))
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

    fun logout() = tokenStorage.clearToken()

    private fun parseError(e: Exception): String = when {
        e.message?.contains("401") == true -> "Неверный email или пароль"
        e.message?.contains("409") == true -> "Пользователь с таким email уже существует"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> e.message ?: "Неизвестная ошибка"
    }
}
