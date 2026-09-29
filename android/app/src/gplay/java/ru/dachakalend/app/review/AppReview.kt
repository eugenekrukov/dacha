package ru.dachakalend.app.review

import android.app.Activity
import android.util.Log
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Нативный запрос оценки Google Play (gplay-флейвор). Копия для rustore — в src/rustore.
 * Play сам решает (квоты), показывать ли форму, и не сообщает, показана ли она, —
 * поэтому onDone вызывается в любом терминальном исходе, чтобы больше не дёргать.
 */
object AppReview {
    private const val TAG = "AppReview"

    fun request(activity: Activity, onDone: () -> Unit) {
        val manager = ReviewManagerFactory.create(activity.applicationContext)
        manager.requestReviewFlow().addOnCompleteListener { req ->
            if (!req.isSuccessful) {
                Log.w(TAG, "requestReviewFlow failed: ${req.exception?.message}")
                onDone()
                return@addOnCompleteListener
            }
            manager.launchReviewFlow(activity, req.result).addOnCompleteListener { onDone() }
        }
    }
}
