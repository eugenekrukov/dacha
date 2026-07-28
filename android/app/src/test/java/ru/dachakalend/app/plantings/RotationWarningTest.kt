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

    @Test
    fun `посадка не предупреждает сама на себя`() {
        // Посадка входит в историю своей же грядки: без исключения по id карточка Гороха
        // сообщала бы «тут рос горох, нужен перерыв» про сам этот горох.
        val b = bed("Грядка у парника", listOf(BedHistoryEntry("Горох", "Бобовые", 2026, plantingId = 7)))
        assertNull(rotationWarning(b, "Бобовые", excludePlantingId = 7))
    }

    @Test
    fun `другая посадка того же семейства на грядке — предупреждение остаётся`() {
        val b = bed(
            "Грядка у парника",
            listOf(
                BedHistoryEntry("Горох", "Бобовые", 2026, plantingId = 7),
                BedHistoryEntry("Фасоль", "Бобовые", 2025, plantingId = 3)
            )
        )
        assertEquals(
            "На грядке «Грядка у парника» в 2025 росла культура семейства «Бобовые» (Фасоль) — " +
                "для этого семейства рекомендуют перерыв 3–4 года.",
            rotationWarning(b, "Бобовые", excludePlantingId = 7)
        )
    }

    @Test
    fun `создание новой посадки — история не фильтруется`() {
        // excludePlantingId = null: старый сервер без planting_id не должен «терять» историю.
        val b = bed("Грядка", listOf(BedHistoryEntry("Томат", "Паслёновые", 2025)))
        assertEquals(
            "На грядке «Грядка» в 2025 росла культура семейства «Паслёновые» (Томат) — " +
                "для этого семейства рекомендуют перерыв 3–4 года.",
            rotationWarning(b, "Паслёновые")
        )
    }
}
