package ru.dachakalend.app.notification

import android.content.Context
import androidx.work.*
import ru.dachakalend.app.data.model.Reminder
import java.time.Instant
import java.time.OffsetDateTime
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReminderScheduler @Inject constructor(private val context: Context) {

    fun schedule(reminder: Reminder) {
        val remindAt = runCatching {
            OffsetDateTime.parse(reminder.remindAt).toInstant()
        }.getOrNull() ?: return

        val delayMs = remindAt.toEpochMilli() - Instant.now().toEpochMilli()
        if (delayMs <= 0) return

        val data = workDataOf(
            ReminderWorker.KEY_TITLE to (reminder.message ?: reminder.type ?: "Напоминание"),
            ReminderWorker.KEY_MESSAGE to (reminder.message ?: ""),
            ReminderWorker.KEY_ID to reminder.id
        )

        val request = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .setInputData(data)
            .addTag("reminder_${reminder.id}")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "reminder_${reminder.id}",
            ExistingWorkPolicy.REPLACE,
            request
        )
    }

    fun cancel(reminderId: Int) {
        WorkManager.getInstance(context).cancelUniqueWork("reminder_$reminderId")
    }
}
