package ru.dachakalend.app.ui.onboarding

import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.dachakalend.app.ui.theme.HeroGradientEnd
import ru.dachakalend.app.ui.theme.HeroGradientStart
import ru.dachakalend.app.ui.theme.NunitoFamily

// Diagonal clip — same visual language as TodayScreen
private val IntroDiagonalShape: GenericShape
    get() = GenericShape { size, _ ->
        moveTo(0f, 0f)
        lineTo(size.width, 0f)
        lineTo(size.width, size.height * 0.88f)
        lineTo(0f, size.height)
        close()
    }

private data class SlideData(
    val emoji: String,
    val title: String,
    val heroHeight: Dp,
)

private val slides = listOf(
    SlideData("🌻", "Календарь дачника", 380.dp),
    SlideData("📋", "Всё под контролем",  280.dp),
    SlideData("🗓️", "Умный план\nна каждый день", 300.dp),
    SlideData("🚀", "Начнём!", 340.dp),
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TutorialIntroScreen(
    onRegister: () -> Unit,
    onLogin: () -> Unit,
    onSkip: () -> Unit,
) {
    val pagerState = rememberPagerState { slides.size }
    val scope = rememberCoroutineScope()

    val infiniteTransition = rememberInfiniteTransition(label = "float")
    val floatOffsetPx by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = -14f,
        animationSpec = infiniteRepeatable(tween(3000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "floatY"
    )

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {

        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            IntroSlidePage(
                slide     = slides[page],
                page      = page,
                floatOffsetPx = floatOffsetPx,
                onNext    = {
                    if (page < slides.lastIndex)
                        scope.launch { pagerState.animateScrollToPage(page + 1) }
                    else
                        onRegister()
                },
                onLogin    = onLogin,
            )
        }

        // Skip button — visible on slides 0-2
        if (pagerState.currentPage < slides.lastIndex) {
            TextButton(
                onClick = onSkip,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 48.dp, end = 12.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White.copy(alpha = 0.22f))
            ) {
                Text(
                    "Пропустить",
                    fontFamily  = NunitoFamily,
                    fontWeight  = FontWeight.Bold,
                    fontSize    = 13.sp,
                    color       = Color.White,
                )
            }
        }
    }
}

@Composable
private fun IntroSlidePage(
    slide: SlideData,
    page: Int,
    floatOffsetPx: Float,
    onNext: () -> Unit,
    onLogin: () -> Unit,
) {
    val heroGradient = Brush.linearGradient(
        colors = listOf(HeroGradientStart, HeroGradientEnd),
        start  = androidx.compose.ui.geometry.Offset(0f, 0f),
        end    = androidx.compose.ui.geometry.Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
    )

    Column(Modifier.fillMaxSize()) {

        // ── Hero ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(slide.heroHeight)
                .clip(IntroDiagonalShape)
                .background(heroGradient)
        ) {
            // Decorative circles
            Box(
                Modifier
                    .size(240.dp)
                    .offset(x = 120.dp, y = (-60).dp)
                    .background(Color.White.copy(alpha = 0.08f), CircleShape)
            )
            Box(
                Modifier
                    .size(140.dp)
                    .offset(x = (-40).dp, y = slide.heroHeight - 80.dp)
                    .background(Color.White.copy(alpha = 0.06f), CircleShape)
            )

            // Emoji + title (centered, above diagonal)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 46.dp, bottom = (slide.heroHeight.value * 0.14f).dp),
                horizontalAlignment    = Alignment.CenterHorizontally,
                verticalArrangement   = Arrangement.Center,
            ) {
                Text(
                    text     = slide.emoji,
                    fontSize = 72.sp,
                    modifier = Modifier.graphicsLayer { translationY = floatOffsetPx },
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    text       = slide.title,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize   = 28.sp,
                    color      = Color.White,
                    textAlign  = TextAlign.Center,
                    lineHeight = 34.sp,
                    modifier   = Modifier.padding(horizontal = 28.dp),
                )
            }
        }

        // ── Slide content ──
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
        ) {
            when (page) {
                0 -> Slide1Content()
                1 -> Slide2Content()
                2 -> Slide3Content()
                3 -> Slide4Content(onLogin = onLogin)
            }
        }

        // ── Bottom bar ──
        Column(
            modifier               = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 40.dp, top = 16.dp),
            horizontalAlignment    = Alignment.CenterHorizontally,
            verticalArrangement   = Arrangement.spacedBy(14.dp),
        ) {
            // Dots
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(slides.size) { i ->
                    Box(
                        Modifier
                            .height(8.dp)
                            .width(if (i == page) 28.dp else 8.dp)
                            .clip(CircleShape)
                            .background(
                                if (i == page) MaterialTheme.colorScheme.primary
                                else Color(0xFFD4C8B8)
                            )
                    )
                }
            }

            // Primary button
            Button(
                onClick  = onNext,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape    = RoundedCornerShape(16.dp),
                colors   = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp),
            ) {
                Text(
                    text       = if (page < slides.lastIndex) "Далее →" else "🌱 Зарегистрироваться",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize   = 16.sp,
                    softWrap   = false,
                )
            }

            // Login link (slide 4 only)
            if (page == slides.lastIndex) {
                TextButton(onClick = onLogin) {
                    Text(
                        "Уже есть аккаунт? Войти",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 14.sp,
                        color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    "Затем 299 ₽/мес или 1 990 ₽/год.\nОтменить можно в любое время.",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize   = 12.sp,
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign  = TextAlign.Center,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

// ─── Slide content composables ─────────────────────────────────────────────

@Composable
private fun Slide1Content() {
    Column(
        Modifier.fillMaxSize().padding(top = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IntroFeaturePill("🌱", "Посадки под контролем")
        IntroFeaturePill("⛅", "Советы с учётом погоды")
        IntroFeaturePill("🔔", "Умные напоминания")
    }
}

@Composable
private fun Slide2Content() {
    Column(
        Modifier.fillMaxSize().padding(top = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IntroFeatureRow(
            iconBg   = Color(0xFFE3F2FD),
            icon     = "💧",
            title    = "Полив и подкормка",
            subtitle = "Напоминания по расписанию с учётом климата",
        )
        IntroFeatureRow(
            iconBg   = Color(0xFFFFF3E0),
            icon     = "🌡️",
            title    = "Погода и риски",
            subtitle = "Предупреждения о заморозках и жаре",
        )
        IntroFeatureRow(
            iconBg   = Color(0xFFE8F5E9),
            icon     = "📊",
            title    = "Журнал и урожай",
            subtitle = "История действий и статистика по сезонам",
        )
    }
}

@Composable
private fun Slide3Content() {
    Column(
        Modifier.fillMaxSize().padding(top = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IntroTaskCard("💧", "Полить томаты",   "3 дня без полива",  Color(0xFFFF7B00), "Срочно",  Color(0xFFFFF3E0), Color(0xFFFF7B00))
        IntroTaskCard("❄️", "Риск заморозка", "Завтра до −2°C",    Color(0xFF42A5F5), "Сегодня", Color(0xFFE3F2FD), Color(0xFF1565C0))
        IntroTaskCard("🥒", "Урожай огурцов", "Готовы к сбору",    Color(0xFF2E7D32), "Готово",  Color(0xFFE8F5E9), Color(0xFF2E7D32))
    }
}

@Composable
private fun Slide4Content(onLogin: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(top = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Free trial badge
        Row(
            Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFFE8F5E9))
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("🎁", fontSize = 14.sp)
            Text(
                "7 дней бесплатно",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Bold,
                fontSize   = 13.sp,
                color      = Color(0xFF2E7D32),
            )
        }

        Text(
            "Создайте аккаунт — это займёт\nменьше минуты",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize   = 15.sp,
            color      = Color(0xFF555555),
            lineHeight = 22.sp,
        )

        Spacer(Modifier.height(4.dp))

        IntroCTACheckItem("Все функции бесплатно 7 дней")
        IntroCTACheckItem("Без привязки карты")
        IntroCTACheckItem("Отмена в любой момент")
    }
}

// ─── Reusable small composables ────────────────────────────────────────────

@Composable
private fun IntroFeaturePill(icon: String, label: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(16.dp))
            .background(Color.White, RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(icon, fontSize = 20.sp)
        Text(
            label,
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.ExtraBold,
            fontSize   = 14.sp,
            color      = Color(0xFF444444),
        )
    }
}

@Composable
private fun IntroFeatureRow(iconBg: Color, icon: String, title: String, subtitle: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(18.dp))
            .background(Color.White, RoundedCornerShape(18.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(iconBg),
            contentAlignment = Alignment.Center,
        ) {
            Text(icon, fontSize = 22.sp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title,    fontFamily = NunitoFamily, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = Color(0xFF1A1A1A))
            Text(subtitle, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,  fontSize = 12.sp, color = Color(0xFF888888), lineHeight = 17.sp)
        }
    }
}

@Composable
private fun IntroTaskCard(
    emoji: String,
    title: String,
    subtitle: String,
    borderColor: Color,
    badgeText: String,
    badgeBg: Color,
    badgeTextColor: Color,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(16.dp))
            .background(Color.White, RoundedCornerShape(16.dp))
            .then(
                Modifier.clip(RoundedCornerShape(16.dp)).then(
                    Modifier
                        .background(Color.White)
                        .padding(start = 0.dp)
                )
            )
            .padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .width(4.dp)
                .height(40.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(borderColor)
        )
        Text(emoji, fontSize = 22.sp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title,    fontFamily = NunitoFamily, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Color(0xFF1A1A1A))
            Text(subtitle, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,  fontSize = 11.sp, color = Color(0xFF9E7050))
        }
        Box(
            Modifier.clip(CircleShape).background(badgeBg).padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text(badgeText, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = badgeTextColor)
        }
    }
}

@Composable
private fun IntroCTACheckItem(text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Text("✓", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black, fontFamily = NunitoFamily)
        }
        Text(
            text,
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Bold,
            fontSize   = 14.sp,
            color      = Color(0xFF444444),
        )
    }
}
