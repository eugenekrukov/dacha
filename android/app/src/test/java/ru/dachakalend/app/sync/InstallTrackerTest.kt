package ru.dachakalend.app.sync

import android.content.Context
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Test
import java.time.LocalDate
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.sync.InstallTracker

class InstallTrackerTest {

    private val tracker = InstallTracker(
        mockk<Context>(relaxed = true),
        mockk<DachaApi>(relaxed = true),
        mockk<TokenStorage>(relaxed = true)
    )

    @Test
    fun `referrer непустой — попадает в payload`() {
        val payload = tracker.buildPayload("device1", "rustore", "1.0.12", "utm_source=vk_ads")
        assertEquals("utm_source=vk_ads", payload["install_referrer"])
    }

    @Test
    fun `referrer null — install_referrer не отправляется`() {
        val payload = tracker.buildPayload("device1", "gplay", "1.0.12", null)
        assertFalse(payload.containsKey("install_referrer"))
    }

    @Test
    fun `referrer пустая строка — install_referrer не отправляется`() {
        val payload = tracker.buildPayload("device1", "gplay", "1.0.12", "   ")
        assertFalse(payload.containsKey("install_referrer"))
    }

    @Test
    fun `ключ открытия — один на день и состояние входа`() {
        val day = LocalDate.of(2026, 9, 15)
        assertEquals(tracker.appOpenKey(day, false), tracker.appOpenKey(day, false))
        assertNotEquals(tracker.appOpenKey(day, false), tracker.appOpenKey(day, true))
        assertNotEquals(tracker.appOpenKey(day, true), tracker.appOpenKey(day.plusDays(1), true))
    }
}
