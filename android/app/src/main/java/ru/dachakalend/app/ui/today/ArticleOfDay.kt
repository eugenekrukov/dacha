package ru.dachakalend.app.ui.today

import ru.dachakalend.app.data.model.BlogPost
import java.time.LocalDate

/**
 * «Статья дня» — чистая функция, без состояния на сервере. Зеркало web
 * (web/src/lib/articleOfDay.ts) — тот же алгоритм, чтобы один и тот же день давал одну
 * и ту же статью на обеих платформах.
 *
 * Контент блога уже сезонный — просто статья, опубликованная сегодня, а если сегодня
 * ничего не вышло — последняя из уже опубликованных. Будущие статьи не показываем.
 */
fun pickArticleOfDay(items: List<BlogPost>, today: LocalDate): BlogPost? {
    return items
        .mapNotNull { post -> runCatching { LocalDate.parse(post.publishedAt.take(10)) }.getOrNull()?.let { it to post } }
        .filter { (date, _) -> !date.isAfter(today) }
        .maxByOrNull { (date, _) -> date }
        ?.second
}
