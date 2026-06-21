package ru.dachakalend.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import ru.dachakalend.app.ads.Ads
import ru.dachakalend.app.notification.NotificationHelper
import ru.rustore.sdk.pushclient.RuStorePushClient
import javax.inject.Inject

@HiltAndroidApp
class App : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var connectivityObserver: ru.dachakalend.app.data.sync.ConnectivityObserver

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannel(this)

        // Пуши: rustore-сборка — через RuStore Push SDK; gplay/samsung — через FCM (Firebase
        // авто-инициализируется плагином google-services, ручной init не нужен).
        if (BuildConfig.STORE == "rustore") {
            RuStorePushClient.init(
                application = this,
                projectId = BuildConfig.RUSTORE_PUSH_PROJECT_ID
            )
        }
        // Биллинг — прямые платежи ЮKassa (см. SubscriptionManager/BillingRepository), SDK не нужен.

        // Реклама РСЯ — no-op в rustore-сборке, реальная инициализация в gplay/samsung (src/withAds).
        Ads.init(this)

        connectivityObserver.start()
    }
}
