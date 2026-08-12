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

/**
 * День года (1 = 1 января) → дата указанного года. Високосный год учитывается сам.
 * Зеркало backend dateFromDoy (utils/todayLogic.js).
 */
fun dateFromDoy(doy: Int, year: Int): java.time.LocalDate =
    java.time.LocalDate.ofYearDay(year, doy.coerceIn(1, java.time.Year.of(year).length()))

/**
 * Эффективная дата отсчёта графика ухода для многолетников (crop.isPerennial).
 *
 * Уход привязан к КАЛЕНДАРЮ, а не к дате посадки: смородину обрезают весной независимо от
 * того, посадили её в октябре или в мае. Якорь — начало сезона ухода в зоне участка
 * (seasonStart). Без зоны — фолбэк на годовщину посадки в текущем сезоне.
 *
 * Якорь может оказаться РАНЬШЕ даты посадки (куст завели в середине сезона) — это намеренно,
 * задачи до посадки отсекаются отдельно там, где строится список.
 *
 * Живёт здесь, а не в экране: логика зеркалится в трёх местах (backend
 * utils/todayLogic.effectivePlantedAt, web api/schedule.ts effectivePlanted, Android) —
 * внутри Android держим ОДНУ копию на все экраны, расхождение копий уже дважды давало баг.
 */
fun effectivePlanted(
    planted: java.time.LocalDate,
    isPerennial: Boolean,
    today: java.time.LocalDate,
    seasonStart: Int? = null
): java.time.LocalDate {
    if (!isPerennial) return planted
    if (seasonStart != null) {
        var anchor = dateFromDoy(seasonStart, today.year)
        // Сезон этого года ещё далеко впереди — значит идёт прошлогодний.
        if (java.time.temporal.ChronoUnit.DAYS.between(today, anchor) > 31) {
            anchor = dateFromDoy(seasonStart, today.year - 1)
        }
        return anchor
    }
    if (java.time.temporal.ChronoUnit.DAYS.between(planted, today) < 365) return planted
    var anniv = planted.withYear(today.year)
    if (java.time.temporal.ChronoUnit.DAYS.between(today, anniv) > 31) anniv = anniv.withYear(today.year - 1)
    return anniv
}
