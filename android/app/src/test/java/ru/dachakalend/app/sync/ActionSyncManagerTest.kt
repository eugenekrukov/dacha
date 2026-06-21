package ru.dachakalend.app.sync

import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.sync.ActionSyncManager
import java.io.IOException

class ActionSyncManagerTest {

    private fun http(code: Int) = HttpException(Response.error<Any>(code, "".toResponseBody(null)))
    private fun logOp(id: String) = QueuedOp(clientId = id, op = "LOG", plantingId = 1, type = "watering")
    private val sentAction = ActionLog(1, 1, null, "watering", null, false, "2026-06-20T00:00:00Z")

    @Test
    fun `успешная отправка снимает операцию из очереди`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } returns sentAction

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("a") }
    }

    @Test
    fun `сетевая ошибка останавливает прогон и НЕ снимает операцию`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"), logOp("b"))
        coEvery { api.createAction(any()) } throws IOException("offline")

        ActionSyncManager(api, queue).sync()

        verify(exactly = 0) { queue.remove(any()) }
    }

    @Test
    fun `4xx снимает операцию (неретраибельно)`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } throws http(403)

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("a") }
    }

    @Test
    fun `5xx оставляет операцию в очереди`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(logOp("a"))
        coEvery { api.createAction(any()) } throws http(500)

        ActionSyncManager(api, queue).sync()

        verify(exactly = 0) { queue.remove("a") }
    }

    @Test
    fun `DELETE 404 трактуется как успех`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        every { queue.load() } returns listOf(QueuedOp(clientId = "d", op = "DELETE", plantingId = 1, targetServerId = 7))
        coEvery { api.deleteAction(7) } throws http(404)

        ActionSyncManager(api, queue).sync()

        verify { queue.remove("d") }
    }
}
