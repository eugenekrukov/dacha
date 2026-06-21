package ru.dachakalend.app.actions

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.ActionQueue
import ru.dachakalend.app.data.local.QueuedOp
import ru.dachakalend.app.data.local.TodayCache
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.Result
import java.io.IOException

class ActionsRepositoryTest {

    private val saved = ActionLog(5, 1, null, "watering", null, false, "2026-06-20T00:00:00Z")

    @Test
    fun `онлайн-лог отправляет на сервер и НЕ ставит в очередь`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { api.createAction(any()) } returns saved

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.logAction(1, "watering")

        assertTrue(res is Result.Success)
        assertEquals(5, (res as Result.Success).data.id)
        verify(exactly = 0) { queue.enqueue(any()) }
    }

    @Test
    fun `офлайн-лог ставит в очередь и возвращает pending-действие`() = runTest {
        val api = mockk<DachaApi>()
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { api.createAction(any()) } throws IOException("offline")

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.logAction(1, "watering")

        assertTrue(res is Result.Success)
        val action = (res as Result.Success).data
        assertTrue(action.pending)
        assertTrue(action.id < 0)
        val opSlot = slot<QueuedOp>()
        verify { queue.enqueue(capture(opSlot)) }
        assertEquals("LOG", opSlot.captured.op)
        assertEquals(action.clientId, opSlot.captured.clientId)
    }

    @Test
    fun `удаление ещё не синхронизированного действия убирает его из очереди без сервера`() = runTest {
        val api = mockk<DachaApi>(relaxed = true)
        val queue = mockk<ActionQueue>(relaxed = true)
        val cache = mockk<TodayCache>(relaxed = true)
        coEvery { queue.removeByTargetClientId("c1") } returns true

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.deleteAction(-7, clientId = "c1")

        assertTrue(res is Result.Success)
        coVerify(exactly = 0) { api.deleteAction(any()) }
    }

    @Test
    fun `офлайн changeStage ставит STAGE в очередь и возвращает Success`() = runTest {
        val api = io.mockk.mockk<ru.dachakalend.app.data.api.DachaApi>()
        val queue = io.mockk.mockk<ru.dachakalend.app.data.local.ActionQueue>(relaxed = true)
        val cache = io.mockk.mockk<ru.dachakalend.app.data.local.TodayCache>(relaxed = true)
        coEvery { api.updatePlantingStage(any(), any()) } throws java.io.IOException("offline")

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.changeStage(3, "transplanted")

        assertTrue(res is Result.Success)
        val opSlot = io.mockk.slot<ru.dachakalend.app.data.local.QueuedOp>()
        verify { queue.enqueue(capture(opSlot)) }
        assertEquals("STAGE", opSlot.captured.op)
        assertEquals("transplanted", opSlot.captured.stage)
    }

    @Test
    fun `офлайн-удаление серверного действия ставит DELETE в очередь`() = runTest {
        val api = io.mockk.mockk<ru.dachakalend.app.data.api.DachaApi>()
        val queue = io.mockk.mockk<ru.dachakalend.app.data.local.ActionQueue>(relaxed = true)
        val cache = io.mockk.mockk<ru.dachakalend.app.data.local.TodayCache>(relaxed = true)
        coEvery { api.deleteAction(any()) } throws java.io.IOException("offline")

        val repo = ActionsRepository(api, queue, cache)
        val res = repo.deleteAction(42)

        assertTrue(res is Result.Success)
        val opSlot = io.mockk.slot<ru.dachakalend.app.data.local.QueuedOp>()
        verify { queue.enqueue(capture(opSlot)) }
        assertEquals("DELETE", opSlot.captured.op)
        assertEquals(42, opSlot.captured.targetServerId)
    }
}
