package ru.dachakalend.app.data.local

import android.content.Context
import androidx.core.content.edit
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Одна отложенная мутация (F1). op: "LOG" | "STAGE" | "DELETE". */
@JsonClass(generateAdapter = true)
data class QueuedOp(
    val clientId: String,            // UUID — ключ идемпотентности
    val op: String,
    val plantingId: Int,
    // LOG
    val type: String? = null,
    val notes: String? = null,
    val auto: Boolean = false,
    val loggedAt: String? = null,    // ISO, клиентское время
    // STAGE
    val stage: String? = null,       // "transplanted"
    // DELETE
    val targetServerId: Int? = null,
    val targetClientId: String? = null,
    val createdAt: Long = 0L,
)

/**
 * Персистентная FIFO-очередь офлайн-мутаций (F1). Хранится в отдельном SharedPreferences-файле,
 * сериализация Moshi. Доступ синхронизирован — параллельная синхронизация и запись не должны
 * наслаиваться. size — реактивный размер для индикатора «N действий ждут отправки».
 */
@Singleton
class ActionQueue @Inject constructor(
    @param:ApplicationContext context: Context,
    moshi: Moshi,
) {
    private val prefs = context.getSharedPreferences("dacha_action_queue", Context.MODE_PRIVATE)
    private val adapter = moshi.adapter<List<QueuedOp>>(
        Types.newParameterizedType(List::class.java, QueuedOp::class.java)
    )

    private val _size = MutableStateFlow(load().size)
    val size: StateFlow<Int> = _size.asStateFlow()

    @Synchronized
    fun load(): List<QueuedOp> {
        val json = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { adapter.fromJson(json) }.getOrNull() ?: emptyList()
    }

    @Synchronized
    fun enqueue(op: QueuedOp) {
        val list = load().toMutableList()
        list.add(op)
        // Мягкий потолок: на дачный сценарий с запасом, отбрасываем самые старые.
        while (list.size > MAX) list.removeAt(0)
        persist(list)
    }

    @Synchronized
    fun remove(clientId: String) {
        persist(load().filterNot { it.clientId == clientId })
    }

    @Synchronized
    fun removeByTargetClientId(targetClientId: String): Boolean {
        val before = load()
        val after = before.filterNot { it.clientId == targetClientId }
        persist(after)
        return after.size != before.size
    }

    @Synchronized
    fun clear() = persist(emptyList())

    private fun persist(list: List<QueuedOp>) {
        prefs.edit { putString(KEY, adapter.toJson(list)) }
        _size.value = list.size
    }

    private companion object {
        const val KEY = "queue"
        const val MAX = 200
    }
}
