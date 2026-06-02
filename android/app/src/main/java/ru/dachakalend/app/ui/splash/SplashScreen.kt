package ru.dachakalend.app.ui.splash

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.dachakalend.app.R
import ru.dachakalend.app.ui.theme.NunitoFamily

@Composable
fun SplashScreen(onDone: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "sway")
    val angle by infiniteTransition.animateFloat(
        initialValue = -8f,
        targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = CubicBezierEasing(0.45f, 0f, 0.55f, 1f)),
            repeatMode = RepeatMode.Reverse
        ),
        label = "angle"
    )

    LaunchedEffect(Unit) {
        delay(1800)
        onDone()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(R.drawable.ic_sunflower_png),
                contentDescription = null,
                modifier = Modifier
                    .size(width = 130.dp, height = 220.dp)
                    .graphicsLayer {
                        rotationZ = angle
                        transformOrigin = TransformOrigin(0.5f, 1f)
                    }
            )
            Spacer(modifier = Modifier.height(32.dp))
            Text(
                text = "Календарь дачника",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 26.sp,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Знает, что делать на даче сегодня!",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
