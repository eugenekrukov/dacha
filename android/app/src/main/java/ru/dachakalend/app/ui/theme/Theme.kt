package ru.dachakalend.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
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

// ─── Тёмная тема ────────────────────────────────────────────────────────────
// Та же оранжево-зелёная айдентика поверх тёплого тёмно-коричневого фона
// (не нейтральный серый — сохраняет «дачный» характер палитры).
private val DarkBackground       = Color(0xFF1B140D)
private val DarkSurface          = Color(0xFF241C13)
private val DarkSurfaceVariant   = Color(0xFF332720)
private val CreamText            = Color(0xFFF3E6D2)
private val CreamTextMuted       = Color(0xFFCBB89E)

val DachaDarkColorScheme = darkColorScheme(
    primary             = OrangeLight,        // ярче на тёмном фоне, чем глубокий оранжевый
    onPrimary           = SoilBrown,
    primaryContainer    = Color(0xFF4A2E00),
    onPrimaryContainer  = OrangeLight,

    secondary           = OrangeLight,
    onSecondary         = SoilBrown,
    secondaryContainer  = Color(0xFF4A3300),
    onSecondaryContainer = Color(0xFFFFD79A),

    tertiary            = Color(0xFF7BC67E),  // LeafGreen осветлён для контраста на тёмном
    onTertiary          = Color(0xFF0B2E0D),
    tertiaryContainer   = Color(0xFF1E3A20),
    onTertiaryContainer = Color(0xFF9BE09E),

    error               = Color(0xFFEF7A6F),
    onError             = Color(0xFF3A0A05),
    errorContainer      = Color(0xFF4A140C),
    onErrorContainer    = Color(0xFFFFB4A8),

    background          = DarkBackground,
    onBackground        = CreamText,

    surface             = DarkSurface,
    onSurface           = CreamText,
    surfaceVariant      = DarkSurfaceVariant,
    onSurfaceVariant    = CreamTextMuted,

    outline             = Color(0xFFFFC13B).copy(alpha = 0.35f),
    outlineVariant      = Color(0xFF4A3B2E),
)

// ─── Цвета по типу задачи ──────────────────────────────────────────────────
// Тёмный вариант — осветлённые оттенки для контраста на DarkSurface (0xFF241C13),
// та же логика, что уже применена к DachaDarkColorScheme (LeafGreen → 0xFF7BC67E и т.п.).
fun taskColor(type: String, isDark: Boolean = false): Color = if (isDark) when (type) {
    "frost_alert"    -> Color(0xFFEF7A6F) // = DachaDarkColorScheme.error
    "transplant_due" -> OrangeLight
    "watering_due"   -> Color(0xFF64B5F6) // Material Blue 300
    "harvest_due"    -> Color(0xFF7BC67E) // = DachaDarkColorScheme.tertiary
    "care_task_due"  -> Color(0xFFAED581) // Material Light Green 300
    else             -> Color(0xFFFFB74D) // Material Orange 300
} else when (type) {
    "frost_alert"    -> FrostRed
    "transplant_due" -> OrangeLight
    "watering_due"   -> WaterBlue
    "harvest_due"    -> LeafGreen
    "care_task_due"  -> Color(0xFF558B2F)
    else             -> AmberTask
}

// ─── Hero gradient токены (использовать в TodayScreen) ────────────────────
// Конец — тёплый амбер #FF9E3D (не бледный OrangeLight): бледный конец давал белому
// тексту (темп/дата) контраст ниже WCAG AA. Значение зеркалит web-hero (to-[#FF9E3D]).
val HeroGradientStart = OrangeDeep
val HeroGradientEnd   = Color(0xFFFF9E3D)

@Composable
fun DachaCalendarTheme(
    largeFont: Boolean = false,
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    val base = LocalDensity.current
    // «Крупный шрифт» — масштабируем только fontScale (текст крупнее, вёрстка не ломается).
    val density = if (largeFont) Density(base.density, base.fontScale * 1.18f) else base
    MaterialTheme(
        colorScheme = if (darkTheme) DachaDarkColorScheme else DachaColorScheme,
        typography  = DachaTypography
    ) {
        CompositionLocalProvider(LocalDensity provides density, content = content)
    }
}
