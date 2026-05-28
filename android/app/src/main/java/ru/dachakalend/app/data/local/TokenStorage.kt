package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("dacha_prefs", Context.MODE_PRIVATE)

    fun saveToken(token: String) = prefs.edit { putString(KEY_TOKEN, token) }
    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun clearToken() = prefs.edit { remove(KEY_TOKEN) }

    fun saveGardenId(id: Int) = prefs.edit { putInt(KEY_GARDEN_ID, id) }
    fun getGardenId(): Int = prefs.getInt(KEY_GARDEN_ID, -1)

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_GARDEN_ID = "garden_id"
    }
}
