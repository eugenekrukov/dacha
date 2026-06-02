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

    // Настройки уведомлений — все включены по умолчанию
    fun isNotificationEnabled(type: String): Boolean =
        prefs.getBoolean("notif_$type", true)

    fun setNotificationEnabled(type: String, enabled: Boolean) =
        prefs.edit { putBoolean("notif_$type", enabled) }

    // ─── Dismissed recommendations (хранятся с датой, протухают на следующий день) ───

    /**
     * Возвращает ключи рекомендаций, отклонённых СЕГОДНЯ.
     * Формат в prefs: "2026-06-02|key1,2026-06-02|key2,..."
     */
    fun getDismissedRecsForToday(): Set<String> {
        val today = java.time.LocalDate.now().toString()
        val raw   = prefs.getString(KEY_DISMISSED_RECS, "") ?: return emptySet()
        if (raw.isBlank()) return emptySet()
        return raw.split(",")
            .filter { it.startsWith("$today|") }
            .map    { it.removePrefix("$today|") }
            .toSet()
    }

    /**
     * Добавляет ключ отклонённой рекомендации.
     * Автоматически чистит записи прошлых дней.
     */
    fun addDismissedRec(key: String) {
        val today   = java.time.LocalDate.now().toString()
        val raw     = prefs.getString(KEY_DISMISSED_RECS, "") ?: ""
        val todayEntries = if (raw.isBlank()) emptyList()
                           else raw.split(",").filter { it.startsWith("$today|") }
        val updated = (todayEntries + "$today|$key").distinct().joinToString(",")
        prefs.edit { putString(KEY_DISMISSED_RECS, updated) }
    }

    // ─── First launch date (для 7-дневного триала) ───────────────────────────────

    fun getFirstLaunchDate(): Long {
        val stored = prefs.getLong(KEY_FIRST_LAUNCH, 0L)
        if (stored == 0L) {
            val now = System.currentTimeMillis()
            prefs.edit { putLong(KEY_FIRST_LAUNCH, now) }
            return now
        }
        return stored
    }

    fun isTrialActive(): Boolean {
        val firstLaunch = getFirstLaunchDate()
        val daysSince = (System.currentTimeMillis() - firstLaunch) / 86_400_000L
        return daysSince < TRIAL_DAYS
    }

    fun trialDaysLeft(): Int {
        val firstLaunch = getFirstLaunchDate()
        val daysSince = (System.currentTimeMillis() - firstLaunch) / 86_400_000L
        return maxOf(0, (TRIAL_DAYS - daysSince).toInt())
    }

    fun isIntroDone(): Boolean = prefs.getBoolean(KEY_INTRO_DONE, false)
    fun setIntroDone()         = prefs.edit { putBoolean(KEY_INTRO_DONE, true) }

    fun isCoachDone(): Boolean = prefs.getBoolean(KEY_COACH_DONE, false)
    fun setCoachDone()         = prefs.edit { putBoolean(KEY_COACH_DONE, true) }

    /** Полный выход — очищает все данные приложения */
    fun logout() = prefs.edit { clear() }

    companion object {
        private const val KEY_TOKEN           = "auth_token"
        private const val KEY_GARDEN_ID       = "garden_id"
        private const val KEY_CLIMATE_ZONE    = "climate_zone"
        private const val KEY_PLANTINGS_COUNT = "active_plantings_count"
        private const val KEY_PENDING_TASKS   = "pending_tasks"
        private const val KEY_DISMISSED_RECS  = "dismissed_recs"
        private const val KEY_FIRST_LAUNCH    = "first_launch_date"
        private const val KEY_INTRO_DONE      = "intro_done"
        private const val KEY_COACH_DONE      = "coach_done"
        const val TRIAL_DAYS                  = 7L

        const val NOTIF_FROST      = "frost_alert"
        const val NOTIF_HEAT       = "heat_alert"
        const val NOTIF_WATERING   = "watering_due"
        const val NOTIF_FERTILIZE  = "fertilizing_due"
        const val NOTIF_TRANSPLANT = "transplant_due"
    }
}
