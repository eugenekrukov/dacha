package ru.dachakalend.app.notification

import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ru.rustore.sdk.pushclient.messaging.RuStoreMessagingService
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import javax.inject.Inject

@AndroidEntryPoint
class DachaPushService : RuStoreMessagingService() {

    @Inject lateinit var api: DachaApi
    @Inject lateinit var tokenStorage: TokenStorage

    private val scope = CoroutineScope(Dispatchers.IO)

    /**
     * Вызывается при получении нового push-токена.
     * Отправляем токен на бэкенд, если пользователь залогинен.
     */
    override fun onNewToken(token: String) {
        val authToken = tokenStorage.getToken() ?: return
        scope.launch {
            try {
                api.registerPushToken(mapOf("token" to token))
            } catch (e: Exception) {
                // Не критично — попробуем снова при следующем обновлении токена
            }
        }
    }

    /**
     * Вызывается при получении push-уведомления.
     * RuStore SDK автоматически показывает уведомление если в payload есть `notification`.
     * Здесь обрабатываем только data-only пуши (например, silent refresh).
     */
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        // Если в уведомлении нет notification-объекта — показываем вручную
        if (message.notification == null && data.isNotEmpty()) {
            val title = data["title"] ?: return
            val body = data["body"] ?: return
            NotificationHelper.show(applicationContext, message.messageId.hashCode(), title, body)
        }
    }

    override fun onDeletedMessages() {
        // Рекомендуется синхронизироваться с сервером при пропущенных уведомлениях
    }

    override fun onError(errors: List<ru.rustore.sdk.pushclient.common.exception.RuStorePushClientException>) {
        errors.forEach { e ->
            // HostAppNotInstalledException — RuStore не установлен, не критично
            // UnauthorizedException — пользователь не авторизован в RuStore
        }
    }
}
