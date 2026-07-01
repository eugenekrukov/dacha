package ru.dachakalend.app.ui.calendar

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

private val MoonDark = Color(0xFFAEB9CC)
private val MoonLit = Color(0xFFFFF8EB)

// Освещённая часть диска строится по фазе (0=новолуние, 0.5=полнолуние), а не выбирается
// из 8 готовых картинок — форма плавно меняется день ото дня, как в реальности.
private fun litPath(cx: Float, cy: Float, r: Float, phase: Float): Path {
    val theta = phase * 2 * PI.toFloat()
    val waxing = phase < 0.5f
    val baseSign = if (waxing) 1f else -1f
    val ex = if (waxing) r * cos(theta) else -r * cos(theta)
    val steps = 32
    val path = Path()
    for (i in 0..steps) {
        val t = PI.toFloat() * i / steps
        val x = cx + baseSign * r * sin(t)
        val y = cy - r * cos(t)
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    for (i in 0..steps) {
        val t = PI.toFloat() - PI.toFloat() * i / steps
        val x = cx + ex * sin(t)
        val y = cy - r * cos(t)
        path.lineTo(x, y)
    }
    path.close()
    return path
}

@Composable
fun MoonIcon(phaseFraction: Double, modifier: Modifier = Modifier, size: Dp = 24.dp) {
    Canvas(modifier = modifier.size(size)) {
        val r = this.size.minDimension / 2f - 1f
        val cx = this.size.width / 2f
        val cy = this.size.height / 2f
        drawCircle(color = MoonDark, radius = r, center = androidx.compose.ui.geometry.Offset(cx, cy))
        drawPath(path = litPath(cx, cy, r, phaseFraction.toFloat()), color = MoonLit)
    }
}
