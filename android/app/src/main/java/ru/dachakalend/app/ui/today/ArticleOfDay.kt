package ru.dachakalend.app.ui.today

import ru.dachakalend.app.data.model.BlogPost
import java.time.LocalDate

/**
 * «Статья дня» — чистая функция, без состояния на сервере. Зеркало web
 * (web/src/lib/articleOfDay.ts) — тот же алгоритм, чтобы один и тот же день давал одну
 * и ту же статью на обеих платформах (см. spec §6).
 *
 *   pool = статьи с месяцем публикации == месяц(today), сезонный контент
 *   pool пуст → берём весь список; список пуст → null (секция не рисуется)
 *   pool[dayOfYear(today) % pool.size]
 */
fun pickArticleOfDay(items: List<BlogPost>, today: LocalDate): BlogPost? {
    val month = today.monthValue
    val pool = items.filter { runCatching { LocalDate.parse(it.publishedAt.take(10)).monthValue }.getOrNull() == month }
    val source = pool.ifEmpty { items }
    if (source.isEmpty()) return null
    return source[today.dayOfYear % source.size]
}
