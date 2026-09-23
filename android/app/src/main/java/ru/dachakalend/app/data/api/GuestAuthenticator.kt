package ru.dachakalend.app.data.api

import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import org.json.JSONObject
import ru.dachakalend.app.BuildConfig
import ru.dachakalend.app.data.local.TokenStorage
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * У гостя нет пароля, поэтому истёкший JWT (30 дней) он не может обновить через экран входа.
 * На 401 молча берём новый токен тем же device_id (POST /auth/guest идемпотентен) и повторяем
 * запрос один раз. Зарегистрированных пользователей не трогаем — для них поведение прежнее.
 */
@Singleton
class GuestAuthenticator @Inject constructor(
    private val tokenStorage: TokenStorage
) : Authenticator {

    // Отдельный клиент без AuthInterceptor/Authenticator — иначе рекурсия на том же 401.
    private val plainClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        if (!tokenStorage.isGuest() || response.priorResponse != null) return null

        // Пока ждали монитор, другой поток мог уже обновить токен — тогда просто повторяем.
        val sentToken = response.request.header("Authorization")?.removePrefix("Bearer ")
        val current = tokenStorage.getToken()
        if (current != null && current != sentToken) {
            return response.request.newBuilder().header("Authorization", "Bearer $current").build()
        }

        val body = JSONObject()
            .put("device_id", tokenStorage.getGuestDeviceId())
            .put("store", BuildConfig.STORE)
            .toString()
            .toRequestBody("application/json".toMediaType())
        val fresh = try {
            plainClient.newCall(Request.Builder().url(BuildConfig.BASE_URL + "auth/guest").post(body).build())
                .execute().use { r -> if (r.isSuccessful) JSONObject(r.body?.string() ?: "").optString("token") else null }
        } catch (_: Exception) {
            null
        }
        if (fresh.isNullOrEmpty()) return null
        tokenStorage.saveToken(fresh)
        return response.request.newBuilder().header("Authorization", "Bearer $fresh").build()
    }
}
