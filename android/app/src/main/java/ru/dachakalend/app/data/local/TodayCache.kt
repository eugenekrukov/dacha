package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayResponse
import javax.inject.Inject
import javax.inject.Singleton

/** Снимок экрана «Сегодня» для офлайн-показа (F1). Привязан к gardenId. */
@JsonClass(generateAdapter = true)
data class CachedToday(
    val gardenId: Int,
    val cachedAt: Long,                         // epoch-millis
    val today: TodayResponse,
    val recommendations: List<Recommendation>,
    val plantings: List<Planting>,
    val todayActions: List<ActionLog>,
)

/**
 * Кэш последнего успешного «Сегодня» (F1). Один слот; при смене активного сада старый кэш
 * не отдаём (load возвращает null, если gardenId не совпал).
 */
@Singleton
class TodayCache @Inject constructor(
    @param:ApplicationContext context: Context,
    moshi: Moshi,
) {
    private val prefs = context.getSharedPreferences("dacha_today_cache", Context.MODE_PRIVATE)
    private val adapter = moshi.adapter(CachedToday::class.java)

    fun save(snapshot: CachedToday) {
        prefs.edit { putString(KEY, adapter.toJson(snapshot)) }
    }

    fun load(gardenId: Int): CachedToday? {
        val json = prefs.getString(KEY, null) ?: return null
        return runCatching { adapter.fromJson(json) }.getOrNull()?.takeIf { it.gardenId == gardenId }
    }

    /** Обновить только ленту действий (оптимизм при офлайн-логе). No-op, если кэша нет. */
    fun updateActions(transform: (List<ActionLog>) -> List<ActionLog>) {
        val current = runCatching { prefs.getString(KEY, null)?.let { adapter.fromJson(it) } }.getOrNull() ?: return
        save(current.copy(todayActions = transform(current.todayActions)))
    }

    fun clear() = prefs.edit { remove(KEY) }

    private companion object { const val KEY = "snapshot" }
}
