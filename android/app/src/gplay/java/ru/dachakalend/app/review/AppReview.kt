package ru.dachakalend.app.review

import android.app.Activity

/**
 * Заглушка запроса оценки для gplay-сборки. Реальный нативный флоу есть только в rustore
 * (RuStore Reviews SDK). Для Google Play при необходимости здесь можно подключить
 * Play In-App Review отдельно. Сейчас — no-op: сразу onDone(), чтобы не дёргать повторно.
 */
object AppReview {
    fun request(activity: Activity, onDone: () -> Unit) {
        onDone()
    }
}
