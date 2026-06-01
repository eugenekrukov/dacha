package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenStorage @Inject constructor(
    @param:ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("dacha_prefs", Context.MODE_PRIVATE)

    fun saveToken(token: String) = prefs.edit { putString(KEY_TOKEN, token) }
    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun clearToken() = prefs.edit { remove(KEY_TOKEN) }

    fun saveGardenId(id: Int) = prefs.edit { putInt(KEY_GARDEN_ID, id) }
    fun getGardenId(): Int = prefs.getInt(KEY_GARDEN_ID, -1)
    fun hasGarden(): Boolean = getGardenId() != -1

    fun saveClimateZone(zone: String?) = prefs.edit { putString(KEY_CLIMATE_ZONE, zone) }
    fun getClimateZone(): String? = prefs.getString(KEY_CLIMATE_ZONE, null)

    fun saveActivePlantingsCount(count: Int) = prefs.edit { putInt(KEY_PLANTINGS_COUNT, count) }
    fun getActivePlantingsCount(): Int = prefs.getInt(KEY_PLANTINGS_COUNT, 0)

    /**
     * Сохраняет просроченные задачи в формате "plantingId:actionType,plantingId:actionType"
     * Например: "3:watering_due,5:fertilizing_due"
     */
    fun savePendingTasks(tasks: Map<Int, String>) {
        val encoded = tasks.entries.joinToString(",") { "${it.key}:${it.value}" }
        prefs.edit { putString(KEY_PENDING_TASKS, encoded) }
    }

    fun getPendingTasks(): Map<Int, String> {
        val raw = prefs.getString(KEY_PENDING_TASKS, "") ?: return emptyMap()
        if (raw.isBlank()) return emptyMap()
        return raw.split(",").mapNotNull { entry ->
            val parts = entry.split(":")
            if (parts.size == 2) parts[0].toIntOrNull()?.let { it to parts[1] } else null
        }.toMap()
    }

    fun getPendingCount(): Int = getPendingTasks().size

    companion object {
        private const val KEY_TOKEN           = "auth_token"
        private const val KEY_GARDEN_ID       = "garden_id"
        private const val KEY_CLIMATE_ZONE    = "climate_zone"
        private const val KEY_PLANTINGS_COUNT = "active_plantings_count"
        private const val KEY_PENDING_TASKS   = "pending_tasks"
    }
}
