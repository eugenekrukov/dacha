package ru.dachakalend.app.sync

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Читает Google Play Install Referrer (заполняется кнопкой на лендинге через
 * ?referrer=utm_source%3D...). Доступен один раз за жизнь установки — читаем
 * при первом запуске (InstallTracker), результат кэшируется вызывающей стороной.
 */
object InstallReferrer {
    suspend fun get(context: Context): String? = suspendCancellableCoroutine { cont ->
        val client = InstallReferrerClient.newBuilder(context.applicationContext).build()
        client.startConnection(object : InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(responseCode: Int) {
                val referrer = if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                    runCatching { client.installReferrer.installReferrer }.getOrNull()
                } else null
                runCatching { client.endConnection() }
                if (cont.isActive) cont.resume(referrer)
            }
            override fun onInstallReferrerServiceDisconnected() {}
        })
    }
}
