package ru.dachakalend.app.data.sync

import kotlinx.coroutines.sync.Mutex
import retrofit2.HttpException
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.model.CreateActionRequest
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Прогоняет очередь офлайн-мутаций по порядку (FIFO) при возврате связи / foreground /
 * успешном loadToday. Под Mutex — параллельных прогонов не допускаем (иначе двойная отправка).
 */
@Singleton
class ActionSyncManager @Inject constructor(
    private val api: DachaApi,
    private val queue: ActionQueue,
) {
    private val mutex = Mutex()

    suspend fun sync() {
        // Уже идёт прогон — выходим (повторно дёрнут следующим триггером).
        if (!mutex.tryLock()) return
        try {
            for (op in queue.load()) {
                val done = try {
                    send(op)
                    true
                } catch (e: HttpException) {
                    // 4xx (вкл. 404 на DELETE) — неретраибельно: снимаем из очереди.
                    // 5xx — транзиентно: стоп, ждём следующего триггера.
                    e.code() in 400..499
                } catch (e: IOException) {
                    false // нет связи — стоп
                }
                if (done) queue.remove(op.clientId) else break
            }
        } finally {
            mutex.unlock()
        }
    }

    private suspend fun send(op: QueuedOp) {
        when (op.op) {
            "LOG" -> api.createAction(
                CreateActionRequest(
                    plantingId = op.plantingId,
                    type = op.type ?: "other",
                    notes = op.notes,
                    auto = op.auto,
                    clientId = op.clientId,
                    loggedAt = op.loggedAt,
                )
            )
            "STAGE" -> api.updatePlantingStage(op.plantingId, mapOf("stage" to (op.stage ?: "transplanted")))
            "DELETE" -> op.targetServerId?.let { api.deleteAction(it) }
        }
    }
}
