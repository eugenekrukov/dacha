package ru.dachakalend.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

// ─── Палитра Sunny Market v3 ───────────────────────────────────────────────
// Тёплая, солнечная, дачная. Оранжево-янтарный hero + кремовый фон.

// Primary — глубокий оранжевый (hero gradient start, кнопки CTA)
private val OrangeDeep   = Color(0xFFFF7B00)
private val OrangeLight  = Color(0xFFFFC13B)  // hero gradient end
private val OrangeContainer = Color(0xFFFFEDD0) // фон иконок, тёплые акценты

// Text — тёмно-коричневый (читается на кремовом фоне)
private val SoilBrown    = Color(0xFF2D1500)
private val SoilMedium   = Color(0xFF6B4A2E)  // второстепенный текст (затемнён для читаемости 40+)

// Текстовые ссылки — тёмно-оранжевый (контраст ≥4.5:1; яркий primary как текст слишком бледный)
val DachaLink            = Color(0xFFC2410C)

// Background — тёплый крем
private val Cream        = Color(0xFFFFF8EB)
private val CardWhite    = Color(0xFFFFFFFF)

// Акценты задач
private val WaterBlue    = Color(0xFF1565C0)
private val AmberTask    = Color(0xFFE65100)
private val LeafGreen    = Color(0xFF2E7D32)
private val FrostRed     = Color(0xFFD32F2F)

val DachaColorScheme = lightColorScheme(
    primary             = OrangeDeep,
    onPrimary           = Color.White,
    primaryContainer    = OrangeContainer,
    onPrimaryContainer  = SoilBrown,

    secondary           = OrangeLight,
    onSecondary         = SoilBrown,
    secondaryContainer  = Color(0xFFFFF3E0),
    onSecondaryContainer = AmberTask,

    tertiary            = LeafGreen,
    onTertiary          = Color.White,
    tertiaryContainer   = Color(0xFFE8F5E9),
    onTertiaryContainer = LeafGreen,

    error               = FrostRed,
    onError             = Color.White,
    errorContainer      = Color(0xFFFFEBEE),
    onErrorContainer    = FrostRed,

    background          = Cream,
    onBackground        = SoilBrown,

    surface             = CardWhite,
    onSurface           = SoilBrown,
    surfaceVariant      = Color(0xFFF5EDD8),
    onSurfaceVariant    = SoilMedium,

    outline             = Color(0xFFFFB44C).copy(alpha = 0.35f),
    outlineVariant      = Color(0xFFE8D9B8),
)

// ─── Цвета по типу задачи ──────────────────────────────────────────────────
fun taskColor(type: String): Color = when (type) {
    "frost_alert"    -> FrostRed
    "transplant_due" -> OrangeLight
    "watering_due"   -> WaterBlue
    "harvest_due"    -> LeafGreen
    "care_task_due"  -> Color(0xFF558B2F)
    else             -> AmberTask
}

// ─── Hero gradient токены (использовать в TodayScreen) ────────────────────
val HeroGradientStart = OrangeDeep
val HeroGradientEnd   = OrangeLight

@Composable
fun DachaCalendarTheme(
    largeFont: Boolean = false,
    content: @Composable () -> Unit
) {
    val base = LocalDensity.current
    // «Крупный шрифт» — масштабируем только fontScale (текст крупнее, вёрстка не ломается).
    val density = if (largeFont) Density(base.density, base.fontScale * 1.18f) else base
    MaterialTheme(
        colorScheme = DachaColorScheme,
        typography  = DachaTypography
    ) {
        CompositionLocalProvider(LocalDensity provides density, content = content)
    }
}
