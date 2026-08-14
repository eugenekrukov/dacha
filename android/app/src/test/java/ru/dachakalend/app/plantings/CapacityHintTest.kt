package ru.dachakalend.app.plantings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.plantings.capacityHint
import ru.dachakalend.app.ui.plantings.schemeLine
import ru.dachakalend.app.ui.plantings.sizePreview

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
    fun `1х3 метра, томат 40х60 — совпадает с примером из roadmap (~6-7 растений), с числами схемы`() {
        assertEquals(
            "На грядке «Грядка»: 100×300 см — поместится примерно 7 раст. (схема посадки: 60×40 см)",
            capacityHint(bed(100, 300), 40, 60)
        )
    }

    @Test
    fun `грядка меньше схемы посадки — сообщение называет и размер грядки, и нужную схему`() {
        assertEquals(
            "На грядке «Грядка»: 30×30 см меньше рекомендованной схемы посадки для этой культуры — " +
                "нужно хотя бы 60×40 см (между рядами × в ряду) на одно растение.",
            capacityHint(bed(30, 30), 40, 60)
        )
    }

    @Test
    fun `schemeLine — видна сразу, до ввода размера`() {
        assertNull(schemeLine(null, 60))
        assertEquals("Схема посадки культуры: 60×40 см (между рядами × в ряду)", schemeLine(40, 60))
    }

    @Test
    fun `sizePreview — считает по тексту из полей ввода, пустое или нечисловое значение — null`() {
        assertNull(sizePreview("", "300", 40, 60))
        assertNull(sizePreview("abc", "300", 40, 60))
        assertEquals(
            "100×300 см — поместится примерно 7 раст. (схема посадки: 60×40 см)",
            sizePreview("100", "300", 40, 60)
        )
    }
}
