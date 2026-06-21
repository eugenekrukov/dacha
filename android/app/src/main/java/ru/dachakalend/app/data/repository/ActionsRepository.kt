package ru.dachakalend.app.data.repository

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.local.TodayCache
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CreateActionRequest
import java.io.IOException
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.absoluteValue

/** Действие, записанное (в т.ч. оптимистично) — для локального закрытия задачи на «Сегодня». */
data class LoggedActionInfo(val plantingId: Int, val type: String)

@Singleton
class ActionsRepository @Inject constructor(
    private val api: DachaApi,
    private val queue: ActionQueue,
    private val todayCache: TodayCache,
) {

    private val _deletedActionId = MutableSharedFlow<Int>()
    val deletedActionEvents: SharedFlow<Int> = _deletedActionId.asSharedFlow()

    private val _loggedAction = MutableSharedFlow<LoggedActionInfo>()
    val loggedActionEvents: SharedFlow<LoggedActionInfo> = _loggedAction.asSharedFlow()

    suspend fun getActions(plantingId: Int? = null): Result<List<ActionLog>> = try {
        Result.Success(api.getActions(plantingId = plantingId))
    } catch (e: Exception) {
        errorResult(e, "Ошибка загрузки действий")
    }

    suspend fun logAction(plantingId: Int, type: String, notes: String? = null, auto: Boolean = false): Result<ActionLog> {
        val clientId = UUID.randomUUID().toString()
        val loggedAt = Instant.now().toString()
        return try {
            val saved = api.createAction(CreateActionRequest(plantingId, type, notes, auto, clientId, loggedAt))
            _loggedAction.emit(LoggedActionInfo(plantingId, type))
            Result.Success(saved)
        } catch (e: IOException) {
            // Офлайн: ставим в очередь, оптимистично возвращаем синтетическое действие.
            queue.enqueue(QueuedOp(
                clientId = clientId, op = "LOG", plantingId = plantingId,
                type = type, notes = notes, auto = auto, loggedAt = loggedAt,
                createdAt = System.currentTimeMillis(),
            ))
            val optimistic = ActionLog(
                id = -(clientId.hashCode().absoluteValue.coerceAtLeast(1)),
                plantingId = plantingId, cropName = null, type = type,
                notes = notes, auto = auto, loggedAt = loggedAt,
                clientId = clientId, pending = true,
            )
            // Показать сразу в ленте «Сделано сегодня» (если есть кэш).
            todayCache.updateActions { listOf(optimistic) + it }
            _loggedAction.emit(LoggedActionInfo(plantingId, type))
            Result.Success(optimistic)
        } catch (e: Exception) {
            errorResult(e, "Ошибка записи действия")
        }
    }

    /**
     * Смена стадии посадки (напр. «Высадка» → transplanted). Офлайн → ставим STAGE в очередь
     * и оптимистично считаем успешной. Идемпотентна (set-стадия), конфликтов нет.
     */
    suspend fun changeStage(plantingId: Int, stage: String): Result<Unit> = try {
        api.updatePlantingStage(plantingId, mapOf("stage" to stage))
        Result.Success(Unit)
    } catch (e: IOException) {
        queue.enqueue(QueuedOp(
            clientId = UUID.randomUUID().toString(), op = "STAGE",
            plantingId = plantingId, stage = stage, createdAt = System.currentTimeMillis(),
        ))
        Result.Success(Unit)
    } catch (e: Exception) {
        errorResult(e, "Ошибка смены стадии")
    }

    /**
     * Удаление действия. Если действие ещё не синхронизировано (clientId в очереди) — просто
     * убираем операцию из очереди и из кэш-ленты, на сервер не идём. Иначе пытаемся удалить;
     * офлайн → ставим DELETE в очередь (оптимистично считаем удалённым).
     */
    suspend fun deleteAction(id: Int, clientId: String? = null): Result<Unit> {
        if (clientId != null && queue.removeByTargetClientId(clientId)) {
            todayCache.updateActions { actions -> actions.filterNot { it.clientId == clientId } }
            _deletedActionId.emit(id)
            return Result.Success(Unit)
        }
        return try {
            api.deleteAction(id)
            _deletedActionId.emit(id)
            Result.Success(Unit)
        } catch (e: IOException) {
            queue.enqueue(QueuedOp(
                clientId = UUID.randomUUID().toString(), op = "DELETE",
                plantingId = 0, targetServerId = id, createdAt = System.currentTimeMillis(),
            ))
            todayCache.updateActions { actions -> actions.filterNot { it.id == id } }
            _deletedActionId.emit(id)
            Result.Success(Unit)
        } catch (e: Exception) {
            errorResult(e, "Ошибка удаления")
        }
    }
}
