package ru.dachakalend.app.notification

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ru.dachakalend.app.BuildConfig

/**
 * Приём пушей через Firebase Cloud Messaging для gplay/samsung-сборок (устройства с Google).
 * Регистрирует токен с provider='fcm'. В rustore-сборке не используется (там RuStore Push) —
 * onNewToken гейтится по флейвору, чтобы не регистрировать лишний FCM-токен.
 * Переиспользует PushServiceEntryPoint и NotificationHelper из RuStore-сервиса.
 */
class DachaFcmService : FirebaseMessagingService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    private fun ep(): PushServiceEntryPoint =
        EntryPointAccessors.fromApplication(application, PushServiceEntryPoint::class.java)

    override fun onNewToken(token: String) {
        if (BuildConfig.STORE == "rustore") return   // в rustore доставка через RuStore Push
        ep().tokenStorage().getToken() ?: return
        scope.launch {
            try { ep().dachaApi().registerPushToken(mapOf("token" to token, "provider" to "fcm")) }
            catch (_: Exception) {}
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Бэкенд шлёт notification + data. В фоне notification показывает система (onMessageReceived
        // не вызывается); в форграунде показываем сами по data/notification.
        val data = message.data
        val title = message.notification?.title ?: data["title"] ?: return
        val body  = message.notification?.body  ?: data["body"]  ?: return
        val pushType = data["type"] ?: ""
        val gardenId = data["garden_id"] ?: ""

        if (!ep().tokenStorage().isNotificationEnabled(pushType)) return

        NotificationHelper.showWithDeepLink(
            application,
            message.messageId.hashCode(),
            title,
            body,
            pushType,
            gardenId
        )
    }
}
