package ru.dachakalend.app.today

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.dachakalend.app.data.model.BlogPost
import ru.dachakalend.app.ui.today.pickArticleOfDay
import java.time.LocalDate

class ArticleOfDayTest {

    private fun post(slug: String, publishedAt: String) =
        BlogPost(slug = slug, title = slug, url = "https://calendacha.ru/blog/$slug/", publishedAt = publishedAt)

    @Test
    fun `одинаковая дата даёт одну и ту же статью`() {
        val items = listOf(
            post("a", "2026-07-01T10:00:00+03:00"),
            post("b", "2026-07-05T10:00:00+03:00"),
            post("c", "2026-07-10T10:00:00+03:00"),
        )
        val today = LocalDate.of(2026, 7, 15)
        assertEquals(pickArticleOfDay(items, today)?.slug, pickArticleOfDay(items, today)?.slug)
    }

    @Test
    fun `пул фильтруется по месяцу публикации`() {
        val items = listOf(
            post("july", "2026-07-01T10:00:00+03:00"),
            post("august", "2026-08-01T10:00:00+03:00"),
        )
        val today = LocalDate.of(2026, 7, 20)
        assertEquals("july", pickArticleOfDay(items, today)?.slug)
    }

    @Test
    fun `нет статей за месяц — берём весь список, а не null`() {
        val items = listOf(post("august", "2026-08-01T10:00:00+03:00"))
        val today = LocalDate.of(2026, 7, 20)
        assertEquals("august", pickArticleOfDay(items, today)?.slug)
    }

    @Test
    fun `пустой список — null`() {
        assertNull(pickArticleOfDay(emptyList(), LocalDate.of(2026, 7, 20)))
    }
}
