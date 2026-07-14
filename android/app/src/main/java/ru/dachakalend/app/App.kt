package ru.dachakalend.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import coil.ImageLoader
import coil.ImageLoaderFactory
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import ru.dachakalend.app.notification.NotificationHelper
import ru.rustore.sdk.pushclient.RuStorePushClient
import javax.inject.Inject

@HiltAndroidApp
class App : Application(), Configuration.Provider, ImageLoaderFactory {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var connectivityObserver: ru.dachakalend.app.data.sync.ConnectivityObserver
    @Inject lateinit var installTracker: ru.dachakalend.app.data.sync.InstallTracker

    // Приватные фото (/photos/file/:id) требуют Bearer — Coil по умолчанию использует свой
    // OkHttp без AuthInterceptor и получил бы 401. Отдаём ему app-овский клиент с интерсептором.
    @Inject lateinit var okHttpClient: OkHttpClient

    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this).okHttpClient(okHttpClient).build()

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannel(this)

        // Пуши: rustore-сборка — через RuStore Push SDK; gplay — через FCM (Firebase
        // авто-инициализируется плагином google-services, ручной init не нужен).
        if (BuildConfig.STORE == "rustore") {
            RuStorePushClient.init(
                application = this,
                projectId = BuildConfig.RUSTORE_PUSH_PROJECT_ID
            )
        }
        // Биллинг — прямые платежи ЮKassa (см. SubscriptionManager/BillingRepository), SDK не нужен.

        connectivityObserver.start()
        installTracker.track()
    }
}
