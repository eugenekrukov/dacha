package ru.dachakalend.app.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Слушает возврат связи и прогоняет очередь офлайн-мутаций (F1). Запускается из App.onCreate.
 * Один app-scoped scope; синхронизация защищена Mutex внутри ActionSyncManager.
 */
@Singleton
class ConnectivityObserver @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val syncManager: ActionSyncManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start() {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch { syncManager.sync() }
            }
        })
    }
}
