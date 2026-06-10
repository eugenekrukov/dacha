package ru.dachakalend.app.ads

import android.app.Activity
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Заглушка рекламы для rustore-сборки (платная модель — реклама не показывается).
 * Рекламный SDK в эту сборку НЕ входит (зависимость только в gplay/samsung). Все методы — no-op.
 */
object Ads {
    fun init(context: Context) {}

    @Composable
    fun Banner(modifier: Modifier = Modifier) {}

    fun onContentEvent(activity: Activity) {}
}
