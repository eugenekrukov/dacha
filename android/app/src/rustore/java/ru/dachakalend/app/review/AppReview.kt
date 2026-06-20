package ru.dachakalend.app.review

import android.app.Activity
import android.util.Log
import ru.rustore.sdk.review.RuStoreReviewManagerFactory
import ru.rustore.sdk.review.model.ReviewInfo

/**
 * Нативный запрос оценки RuStore (rustore-флейвор). В gplay/samsung — no-op заглушка
 * (см. копии в src/gplay и src/samsung). Вызывается из MainActivity на 6-й день
 * использования (TokenStorage.isReviewDue()).
 *
 * Поток по доке RuStore: requestReviewFlow() готовит ReviewInfo (живёт ~5 мин), затем
 * launchReviewFlow(reviewInfo) показывает форму. Покажет ли RuStore форму фактически —
 * решает сам стор (квоты/лимиты), приложение на это не влияет и ошибку пользователю не показывает.
 *
 * onDone вызывается в любом терминальном исходе — чтобы пометить попытку и больше не дёргать.
 */
object AppReview {
    private const val TAG = "AppReview"

    fun request(activity: Activity, onDone: () -> Unit) {
        val manager = RuStoreReviewManagerFactory.create(activity.applicationContext)
        manager.requestReviewFlow()
            .addOnSuccessListener { reviewInfo: ReviewInfo ->
                manager.launchReviewFlow(reviewInfo)
                    .addOnSuccessListener { onDone() }
                    .addOnFailureListener { t ->
                        Log.w(TAG, "launchReviewFlow failed: ${t.message}")
                        onDone()
                    }
            }
            .addOnFailureListener { t ->
                // По доке: ошибку пользователю не показываем (он не инициировал процесс).
                Log.w(TAG, "requestReviewFlow failed: ${t.message}")
                onDone()
            }
    }
}
