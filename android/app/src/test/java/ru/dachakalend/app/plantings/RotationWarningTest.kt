package ru.dachakalend.app.plantings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.BedHistoryEntry
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.plantings.rotationWarning

class RotationWarningTest {

    private fun bed(name: String, history: List<BedHistoryEntry>) =
        GardenBed(id = 1, gardenId = 12, name = name, type = "greenhouse", history = history)

    @Test
    fun `нет грядки или нет семейства — нет предупреждения`() {
        assertNull(rotationWarning(null, "Паслёновые"))
        assertNull(rotationWarning(bed("Грядка", emptyList()), null))
    }

    @Test
    fun `семейство не совпадает с историей — нет предупреждения`() {
        val b = bed("Грядка 1", listOf(BedHistoryEntry("Огурец", "Тыквенные", 2025)))
        assertNull(rotationWarning(b, "Паслёновые"))
    }

    @Test
    fun `совпадение семейства — предупреждение с самым свежим годом и культурой`() {
        val b = bed(
            "Теплица 1",
            listOf(
                BedHistoryEntry("Баклажан", "Паслёновые", 2024),
                BedHistoryEntry("Томат", "Паслёновые", 2025)
            )
        )
        assertEquals(
            "На грядке «Теплица 1» в 2025 росла культура семейства «Паслёновые» (Томат) — " +
                "для этого семейства рекомендуют перерыв 3–4 года.",
            rotationWarning(b, "Паслёновые")
        )
    }
}
