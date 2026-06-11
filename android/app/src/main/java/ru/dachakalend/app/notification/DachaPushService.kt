package ru.dachakalend.app.notification

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ru.rustore.sdk.pushclient.messaging.exception.RuStorePushClientException
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage
import ru.rustore.sdk.pushclient.messaging.service.RuStoreMessagingService
import ru.dachakalend.app.BuildConfig
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage

@EntryPoint
@InstallIn(SingletonComponent::class)
interface PushServiceEntryPoint {
    fun dachaApi(): DachaApi
    fun tokenStorage(): TokenStorage
}

class DachaPushService : RuStoreMessagingService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    private fun ep(): PushServiceEntryPoint =
        EntryPointAccessors.fromApplication(application, PushServiceEntryPoint::class.java)

    override fun onNewToken(token: String) {
        if (BuildConfig.STORE != "rustore") return   // gplay/samsung используют FCM
        ep().tokenStorage().getToken() ?: return
        scope.launch {
            try { ep().dachaApi().registerPushToken(mapOf("token" to token, "provider" to "rustore")) }
            catch (_: Exception) {}
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.notification == null && message.data.isNotEmpty()) {
            val title = message.data["title"] ?: return
            val body = message.data["body"] ?: return
            val pushType = message.data["type"] ?: ""
            val gardenId = message.data["garden_id"] ?: ""

            val tokenStorage = ep().tokenStorage()
            if (!tokenStorage.isNotificationEnabled(pushType)) return

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

    override fun onDeletedMessages() {}

    override fun onError(errors: List<RuStorePushClientException>) {}
}
