package ru.dachakalend.app.ui.common

/**
 * ISO-дата с сервера → «10.07.2026». Принимает и голую дату («2026-07-10»), и полный
 * ISO-таймстамп («2026-07-10T12:00:00.000Z») — во втором случае берётся только дата.
 * При неразобранном значении возвращает исходную строку, а не падает.
 */
fun formatIsoDate(iso: String): String = try {
    val d = java.time.LocalDate.parse(iso.take(10))
    "%02d.%02d.%d".format(d.dayOfMonth, d.monthValue, d.year)
} catch (_: Exception) { iso }
