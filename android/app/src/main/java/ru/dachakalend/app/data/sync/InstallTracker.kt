package ru.dachakalend.app.data.sync

import android.annotation.SuppressLint
import android.content.Context
import android.provider.Settings
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ru.dachakalend.app.BuildConfig
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Отправляет "первый запуск" на бэкенд ровно один раз на устройство — считает реальные
 * установки (install_events), в отличие от счётчика стора, который включает установки без
 * единого открытия приложения. Запускается из App.onCreate.
 */
@Singleton
class InstallTracker @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val api: DachaApi,
    private val tokenStorage: TokenStorage,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @SuppressLint("HardwareIds")
    fun track() {
        Log.d("InstallTracker", "track() called, isFirstOpenSent=${tokenStorage.isFirstOpenSent()}")
        if (tokenStorage.isFirstOpenSent()) return
        val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        Log.d("InstallTracker", "deviceId=$deviceId")
        if (deviceId.isNullOrBlank()) return
        scope.launch {
            Log.d("InstallTracker", "coroutine started, calling api")
            runCatching {
                api.trackFirstOpen(
                    mapOf(
                        "device_id" to deviceId,
                        "store" to BuildConfig.STORE,
                        "app_version" to BuildConfig.VERSION_NAME
                    )
                )
            }.onSuccess {
                Log.d("InstallTracker", "sent ok")
                tokenStorage.setFirstOpenSent()
            }.onFailure { Log.w("InstallTracker", "first-open failed, will retry next launch", it) }
        }
    }
}
