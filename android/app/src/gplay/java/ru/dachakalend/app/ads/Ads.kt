package ru.dachakalend.app.ads

import android.app.Activity
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Заглушка рекламы для gplay-сборки. С 2026-06-13 gplay переведён на платную подписку (ЮKassa) —
 * реклама не показывается (Google с 02.08.2022 не требует Google Play Billing для оплаты из РФ,
 * in-app оплата своей системой разрешена). Рекламный SDK в эту сборку НЕ входит. Все методы — no-op.
 * (Реальная реклама РСЯ осталась только в src/samsung.)
 */
object Ads {
    fun init(context: Context) {}

    @Composable
    fun Banner(modifier: Modifier = Modifier) {}

    fun onContentEvent(activity: Activity) {}
}
