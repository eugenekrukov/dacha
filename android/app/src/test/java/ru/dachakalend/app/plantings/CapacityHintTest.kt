package ru.dachakalend.app.plantings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.plantings.capacityHint

class CapacityHintTest {

    private fun bed(widthCm: Int?, lengthCm: Int?) =
        GardenBed(id = 1, gardenId = 12, name = "Грядка", type = "soil", widthCm = widthCm, lengthCm = lengthCm)

    @Test
    fun `нет размеров грядки или схемы посадки — нет подсказки`() {
        assertNull(capacityHint(null, 40, 60))
        assertNull(capacityHint(bed(null, null), 40, 60))
        assertNull(capacityHint(bed(100, 300), null, 60))
        assertNull(capacityHint(bed(100, 300), 40, null))
    }

    @Test
    fun `1х3 метра, томат 40х60 — совпадает с примером из roadmap (~6-7 растений)`() {
        assertEquals(
            "На грядке «Грядка» (100×300 см) поместится примерно 7 раст.",
            capacityHint(bed(100, 300), 40, 60)
        )
    }

    @Test
    fun `грядка меньше схемы посадки — отдельное сообщение, не 0`() {
        assertEquals(
            "Грядка меньше рекомендованной схемы посадки для этой культуры.",
            capacityHint(bed(30, 30), 40, 60)
        )
    }
}
