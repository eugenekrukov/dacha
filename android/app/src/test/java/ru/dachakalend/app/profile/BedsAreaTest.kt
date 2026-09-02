package ru.dachakalend.app.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.profile.bedsAreaLines

class BedsAreaTest {

    private fun bed(id: Int, widthCm: Int?, lengthCm: Int?) =
        GardenBed(id = id, gardenId = 12, name = "Грядка $id", type = "soil", widthCm = widthCm, lengthCm = lengthCm)

    @Test
    fun `грядок нет — обе строки пустые`() {
        val lines = bedsAreaLines(emptyList())
        assertNull(lines.area)
        assertNull(lines.missing)
    }

    @Test
    fun `суммируются только грядки с обоими размерами`() {
        val lines = bedsAreaLines(listOf(bed(1, 100, 300), bed(2, 100, 200)))
        assertEquals("Грядки: 5,0 м² (2 шт.)", lines.area)
        assertNull(lines.missing)
    }

    @Test
    fun `грядка с одним размером идёт в счётчик без размера, а не в площадь`() {
        val lines = bedsAreaLines(listOf(bed(1, 100, 300), bed(2, 100, null), bed(3, null, null)))
        assertEquals("Грядки: 3,0 м² (1 шт.)", lines.area)
        assertEquals("2 грядок без размера — укажите размер при посадке", lines.missing)
    }

    @Test
    fun `одна грядка без размера — единственное число`() {
        val lines = bedsAreaLines(listOf(bed(1, null, null)))
        assertNull(lines.area)
        assertEquals("1 грядка без размера — укажите размер при посадке", lines.missing)
    }
}
