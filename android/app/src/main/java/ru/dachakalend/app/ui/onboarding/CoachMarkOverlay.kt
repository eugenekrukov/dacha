package ru.dachakalend.app.ui.onboarding

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.ui.theme.NunitoFamily

// ─── Public API ────────────────────────────────────────────────────────────

data class CoachStep(val key: String, val title: String, val description: String)

val coachMarkSteps = listOf(
    CoachStep("weather",       "Прогноз погоды",    "Актуальная погода и прогноз на неделю с учётом влажности почвы и риска заморозков."),
    CoachStep("tasks",         "Задачи на сегодня", "Список формируется автоматически — по посадкам, погоде и срокам. Нажмите, чтобы отметить действие."),
    CoachStep("recs",          "Советы дня",        "Полезные рекомендации на каждый день. Смахните, чтобы удалить."),
    CoachStep("nav_plantings", "Ваши посадки",      "Добавьте культуры — и приложение начнёт составлять задачи именно для них."),
    CoachStep("nav_calendar",  "Календарь работ",   "Расписание всех дачных работ для удобного планирования."),
)

class CoachMarkController {
    val boundsMap  = mutableStateMapOf<String, Rect>()
    var currentStep by mutableIntStateOf(0)
    var isVisible   by mutableStateOf(false)
    private var wasShown = false

    val currentKey: String get() = coachMarkSteps.getOrNull(currentStep)?.key ?: ""

    /** Показывает туториал ровно один раз за жизнь контроллера. */
    fun showOnce() {
        if (wasShown) return
        wasShown = true
        currentStep = 0
        isVisible = true
    }

    fun updateBounds(key: String, rect: Rect) { boundsMap[key] = rect }

    /** Расширяет существующий rect в boundsMap до объединения с новым (для многострочных секций). */
    fun updateBoundsUnion(key: String, rect: Rect) {
        val existing = boundsMap[key]
        boundsMap[key] = if (existing == null) rect else Rect(
            left   = minOf(existing.left,   rect.left),
            top    = minOf(existing.top,    rect.top),
            right  = maxOf(existing.right,  rect.right),
            bottom = maxOf(existing.bottom, rect.bottom),
        )
    }

    /** Сбрасывает накопленный rect (вызывается перед скроллом к секции). */
    fun resetBounds(key: String) { boundsMap.remove(key) }

    fun next(onDone: () -> Unit) {
        if (currentStep < coachMarkSteps.lastIndex) currentStep++
        else { isVisible = false; onDone() }
    }

    fun dismiss(onDone: () -> Unit) { isVisible = false; onDone() }
}

/** Modifier: точно заменяет bounds (одиночный элемент). */
fun Modifier.coachTarget(controller: CoachMarkController?, key: String): Modifier =
    if (controller == null) this
    else this.onGloballyPositioned { controller.updateBounds(key, it.boundsInRoot()) }

/** Modifier: расширяет bounds до объединения (title + все карточки секции). */
fun Modifier.coachTargetUnion(controller: CoachMarkController?, key: String): Modifier =
    if (controller == null) this
    else this.onGloballyPositioned { controller.updateBoundsUnion(key, it.boundsInRoot()) }

// ─── Overlay composable ────────────────────────────────────────────────────

@Composable
fun CoachMarkOverlay(
    controller: CoachMarkController,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val step         = coachMarkSteps.getOrNull(controller.currentStep) ?: return
    val spotlightRect = controller.boundsMap[step.key]

    // Pulse animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f, targetValue = 1.06f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pulse"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            // Тап по затемнению (вне пузыря подсказки) — переход к следующему шагу/завершение.
            // Гарантирует, что оверлей всегда можно закрыть, даже если подсказка не отрисовалась
            // (цель ещё не измерена / вне экрана). Кнопки пузыря перехватывают тап раньше.
            .pointerInput(Unit) { detectTapGestures { controller.next(onDone) } }
    ) {

        // ── Dark scrim + spotlight cutout ──
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
        ) {
            drawRect(Color.Black.copy(alpha = 0.72f))
            if (spotlightRect != null) {
                val pad = 10f
                val r   = if (step.key.startsWith("nav_")) 14.dp.toPx() else 18.dp.toPx()
                drawRoundRect(
                    color      = Color.Transparent,
                    topLeft    = Offset(spotlightRect.left - pad, spotlightRect.top - pad),
                    size       = Size(spotlightRect.width + pad * 2, spotlightRect.height + pad * 2),
                    cornerRadius = CornerRadius(r),
                    blendMode  = BlendMode.Clear,
                )
                // Pulse ring
                val ringPad = pad + (8f * (pulseScale - 1f) / 0.06f)
                drawRoundRect(
                    color        = Color(0xFFFF7B00).copy(alpha = 0.35f * (1f - (pulseScale - 1f) / 0.06f)),
                    topLeft      = Offset(spotlightRect.left - ringPad, spotlightRect.top - ringPad),
                    size         = Size(spotlightRect.width + ringPad * 2, spotlightRect.height + ringPad * 2),
                    cornerRadius = CornerRadius(r + ringPad - pad),
                    blendMode    = BlendMode.SrcOver,
                )
            }
        }

        // ── Tooltip ── рисуем ВСЕГДА (даже без измеренного spotlight), чтобы кнопки
        // «Далее/Готово/Пропустить» были доступны и оверлей нельзя было «заклинить».
        CoachTooltip(
            step        = step,
            stepIndex   = controller.currentStep,
            totalSteps  = coachMarkSteps.size,
            targetRect  = spotlightRect,
            onNext      = { controller.next(onDone) },
            onSkip      = { controller.dismiss(onDone) },
        )
    }
}

@Composable
private fun BoxScope.CoachTooltip(
    step: CoachStep,
    stepIndex: Int,
    totalSteps: Int,
    targetRect: Rect?,
    onNext: () -> Unit,
    onSkip: () -> Unit,
) {
    // Spotlight ещё не измерен (цель вне экрана/не скомпонована) — показываем подсказку
    // по центру без стрелки, чтобы кнопки были доступны и оверлей нельзя было заклинить.
    if (targetRect == null) {
        Box(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center,
        ) {
            CoachBubble(step, stepIndex, totalSteps, onNext, onSkip)
        }
        return
    }

    val density = androidx.compose.ui.platform.LocalDensity.current
    val pad = 10f
    val arrowSize = 10.dp

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val screenHeightPx = constraints.maxHeight.toFloat()
        val arrowGapPx = with(density) { (arrowSize * 3).toPx() }
        val minRoomAbovePx = with(density) { 170.dp.toPx() }

        val spotlightTop    = targetRect.top - pad
        val spotlightBottom = targetRect.bottom + pad
        // Мало места над целью (цель у верхней кромки, напр. погода) → показываем ПОД ней.
        val placeBelow = spotlightTop < minRoomAbovePx

        if (placeBelow) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .align(Alignment.TopCenter)
                    .padding(top = with(density) { (spotlightBottom + arrowGapPx).toDp() })
            ) {
                // Стрелка вверх (к цели)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .offset(y = -arrowSize)
                        .size(arrowSize * 2, arrowSize)
                        .background(
                            Color.White,
                            GenericShape { size, _ ->
                                moveTo(0f, size.height)
                                lineTo(size.width, size.height)
                                lineTo(size.width / 2, 0f)
                                close()
                            }
                        )
                )
                CoachBubble(step, stepIndex, totalSteps, onNext, onSkip)
            }
        } else {
            val tooltipBottomPx = spotlightTop - arrowGapPx
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .align(Alignment.BottomCenter)
                    .padding(bottom = with(density) { (screenHeightPx - tooltipBottomPx).toDp() })
            ) {
                // Стрелка вниз (к цели)
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .offset(y = arrowSize)
                        .size(arrowSize * 2, arrowSize)
                        .background(
                            Color.White,
                            GenericShape { size, _ ->
                                moveTo(0f, 0f)
                                lineTo(size.width, 0f)
                                lineTo(size.width / 2, size.height)
                                close()
                            }
                        )
                )
                CoachBubble(step, stepIndex, totalSteps, onNext, onSkip)
            }
        }
    }
}

@Composable
private fun CoachBubble(
    step: CoachStep,
    stepIndex: Int,
    totalSteps: Int,
    onNext: () -> Unit,
    onSkip: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(20.dp))
            .padding(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Шаг ${stepIndex + 1} из $totalSteps",
            fontFamily  = NunitoFamily,
            fontWeight  = FontWeight.Bold,
            fontSize    = 11.sp,
            color       = MaterialTheme.colorScheme.primary,
            letterSpacing = 0.5.sp,
        )
        Text(
            step.title,
            fontFamily  = NunitoFamily,
            fontWeight  = FontWeight.Black,
            fontSize    = 16.sp,
            color       = Color(0xFF1A1A1A),
        )
        Text(
            step.description,
            fontFamily  = NunitoFamily,
            fontWeight  = FontWeight.SemiBold,
            fontSize    = 13.sp,
            color       = Color(0xFF666666),
            lineHeight  = 19.sp,
        )
        Spacer(Modifier.height(6.dp))

        Row(
            modifier              = Modifier.fillMaxWidth(),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(totalSteps) { i ->
                    Box(
                        Modifier
                            .height(6.dp)
                            .width(if (i == stepIndex) 18.dp else 6.dp)
                            .clip(CircleShape)
                            .background(
                                if (i == stepIndex) MaterialTheme.colorScheme.primary
                                else Color(0xFFDDDDDD)
                            )
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onSkip, contentPadding = PaddingValues(horizontal = 4.dp)) {
                    Text(
                        "Пропустить",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 13.sp,
                        color      = Color(0xFFBBBBBB),
                    )
                }
                Button(
                    onClick  = onNext,
                    shape    = RoundedCornerShape(14.dp),
                    colors   = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
                ) {
                    Text(
                        if (stepIndex == totalSteps - 1) "Готово ✓" else "Далее →",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize   = 13.sp,
                        softWrap   = false,
                    )
                }
            }
        }
    }
}
