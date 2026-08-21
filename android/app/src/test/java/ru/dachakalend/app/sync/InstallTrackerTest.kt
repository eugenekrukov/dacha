package ru.dachakalend.app.sync

import android.content.Context
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
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
}
