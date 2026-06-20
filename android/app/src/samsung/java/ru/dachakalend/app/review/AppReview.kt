package ru.dachakalend.app.review

import android.app.Activity

/**
 * Заглушка запроса оценки для samsung-сборки (бесплатная, с рекламой). Нативный флоу
 * оценки есть только в rustore. No-op: сразу onDone(), чтобы не дёргать повторно.
 */
object AppReview {
    fun request(activity: Activity, onDone: () -> Unit) {
        onDone()
    }
}
