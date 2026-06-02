package ru.dachakalend.app.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import ru.dachakalend.app.MainActivity
import ru.dachakalend.app.R

object NotificationHelper {

    const val CHANNEL_ID = "dacha_reminders"
    private const val CHANNEL_NAME = "Напоминания"

    const val EXTRA_PUSH_TYPE   = "push_type"
    const val EXTRA_GARDEN_ID   = "push_garden_id"

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Напоминания по уходу за растениями"
        }
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    fun show(context: Context, id: Int, title: String, message: String) {
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            NotificationManagerCompat.from(context).notify(id, notification)
        }
    }

    fun showWithDeepLink(
        context: Context,
        id: Int,
        title: String,
        message: String,
        pushType: String,
        gardenId: String = ""
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_PUSH_TYPE, pushType)
            putExtra(EXTRA_GARDEN_ID, gardenId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            NotificationManagerCompat.from(context).notify(id, notification)
        }
    }
}
