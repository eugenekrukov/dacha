package ru.dachakalend.app.sync

import android.content.Context
import kotlinx.coroutines.suspendCancellableCoroutine
import ru.rustore.sdk.install.referrer.InstallReferrerClient
import ru.rustore.sdk.install.referrer.model.InstallReferrer
import kotlin.coroutines.resume

/**
 * Читает RuStore Install Referrer (заполняется кнопкой на лендинге через
 * ?referrerId=...). RuStore хранит значение 10 дней и отдаёт один раз — читаем
 * при первом запуске (InstallTracker), результат кэшируется вызывающей стороной.
 */
object InstallReferrer {
    suspend fun get(context: Context): String? = suspendCancellableCoroutine { cont ->
        InstallReferrerClient(context.applicationContext).getInstallReferrer()
            .addOnSuccessListener { result: InstallReferrer? ->
                if (cont.isActive) cont.resume(result?.referrerId)
            }
            .addOnFailureListener {
                if (cont.isActive) cont.resume(null)
            }
    }
}
