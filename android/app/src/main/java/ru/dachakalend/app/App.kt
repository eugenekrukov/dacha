package ru.dachakalend.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import ru.dachakalend.app.notification.NotificationHelper
import ru.rustore.sdk.billingclient.RuStoreBillingClientFactory
import ru.rustore.sdk.pushclient.RuStorePushClient
import javax.inject.Inject

@HiltAndroidApp
class App : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannel(this)

        // Инициализация RuStore Push SDK
        RuStorePushClient.init(
            application = this,
            projectId = BuildConfig.RUSTORE_PUSH_PROJECT_ID
        )

        // Инициализация RuStore Billing SDK
        // RUSTORE_CONSOLE_APP_ID — числовой ID из RuStore Консоль → Приложения → ID приложения
        RuStoreBillingClientFactory.`init`(
            application = this,
            consoleApplicationId = BuildConfig.RUSTORE_CONSOLE_APP_ID,
            deeplinkScheme = "dachakalend"
        )
    }
}
