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
    fun `есть статья на сегодня — берём её`() {
        val items = listOf(
            post("a", "2026-07-01T10:00:00+03:00"),
            post("b", "2026-07-15T10:00:00+03:00"),
        )
        assertEquals("b", pickArticleOfDay(items, LocalDate.of(2026, 7, 15))?.slug)
    }

    @Test
    fun `на сегодня статьи нет — берём последнюю опубликованную`() {
        val items = listOf(
            post("a", "2026-07-01T10:00:00+03:00"),
            post("b", "2026-07-10T10:00:00+03:00"),
        )
        assertEquals("b", pickArticleOfDay(items, LocalDate.of(2026, 7, 15))?.slug)
    }

    @Test
    fun `будущие статьи не показываем заранее`() {
        val items = listOf(
            post("past", "2026-07-01T10:00:00+03:00"),
            post("future", "2026-07-20T10:00:00+03:00"),
        )
        assertEquals("past", pickArticleOfDay(items, LocalDate.of(2026, 7, 15))?.slug)
    }

    @Test
    fun `все статьи в будущем — null`() {
        val items = listOf(post("future", "2026-08-01T10:00:00+03:00"))
        assertNull(pickArticleOfDay(items, LocalDate.of(2026, 7, 20)))
    }

    @Test
    fun `пустой список — null`() {
        assertNull(pickArticleOfDay(emptyList(), LocalDate.of(2026, 7, 20)))
    }
}
