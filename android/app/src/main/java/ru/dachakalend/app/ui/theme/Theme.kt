package ru.dachakalend.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Палитра: зелёный как основной, тёплые акценты
private val Green700 = Color(0xFF388E3C)
private val Green500 = Color(0xFF4CAF50)
private val Green100 = Color(0xFFC8E6C9)
private val Amber600  = Color(0xFFFFB300)
private val Brown400  = Color(0xFF8D6E63)
private val Red500    = Color(0xFFF44336)

val DachaColorScheme = lightColorScheme(
    primary          = Green700,
    onPrimary        = Color.White,
    primaryContainer = Green100,
    onPrimaryContainer = Green700,
    secondary        = Amber600,
    onSecondary      = Color.Black,
    tertiary         = Brown400,
    error            = Red500,
    background       = Color(0xFFF9F9F4),
    surface          = Color.White,
    onBackground     = Color(0xFF1B1B1B),
    onSurface        = Color(0xFF1B1B1B),
)

// Цвета по типу задачи
fun taskColor(type: String): Color = when (type) {
    "frost_alert"    -> Red500
    "transplant_due" -> Amber600
    "watering_due"   -> Color(0xFF1E88E5)
    "harvest_due"    -> Green500
    else             -> Brown400
}

@Composable
fun DachaCalendarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DachaColorScheme,
        content = content
    )
}
