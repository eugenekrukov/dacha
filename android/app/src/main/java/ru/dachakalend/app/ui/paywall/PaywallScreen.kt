package ru.dachakalend.app.ui.paywall

import android.app.Activity
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.settings.formatPromoDate
import ru.dachakalend.app.ui.theme.NunitoFamily

private val Orange = Color(0xFFFF7B00)
private val OrangeLight = Color(0xFFFFEDD8)
private val Cream = Color(0xFFFFF8EB)
private val Green = Color(0xFF2E7D32)

@Composable
fun PaywallScreen(
    onAccessGranted: () -> Unit,
    viewModel: PaywallViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = context as Activity
    var selectedPlan by remember { mutableStateOf("yearly") }
    var promoCode by remember { mutableStateOf("") }

    // Навигация — ТОЛЬКО по явному событию выдачи доступа (покупка/восстановление/промокод).
    // Не по ambient-статусу: иначе экран, открытый из настроек при активном доступе, сразу закрывался бы.
    LaunchedEffect(uiState.accessGranted) {
        if (uiState.accessGranted) {
            uiState.redeemMessage?.let { Toast.makeText(context, it, Toast.LENGTH_LONG).show() }
            onAccessGranted()
        }
    }

    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Снимаем ошибку через 3 сек
            kotlinx.coroutines.delay(3000)
            viewModel.dismissError()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Cream)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()               // поле промокода не перекрывается клавиатурой
                .padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(48.dp))

            // Hero — иконка + заголовок
            Box(
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.verticalGradient(listOf(Orange, Color(0xFFFF9D3D)))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("🌻", fontSize = 44.sp)
            }

            Spacer(Modifier.height(20.dp))

            Text(
                text = "Дачник Про",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 28.sp,
                color = Color(0xFF1A1A1A)
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "Полный доступ ко всем функциям\nприложения без ограничений",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = Color(0xFF666666),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp
            )

            // Бейдж активного промо (приоритетнее триала)
            if (uiState.status.isPromo) {
                Spacer(Modifier.height(16.dp))
                val promoText = if (uiState.status.isPromoLifetime) "Промокод активен — доступ навсегда"
                    else formatPromoDate(uiState.status.promoUntil)?.let { "Промокод активен до $it" }
                        ?: "Промокод активен"
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(100.dp))
                        .background(Green)
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = promoText,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color.White
                    )
                }
            } else if (uiState.status.isTrialActive) {
                // Триал-бейдж
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(100.dp))
                        .background(Green)
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Осталось ${uiState.status.trialDaysLeft} дн. бесплатного периода",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color.White
                    )
                }
            }

            Spacer(Modifier.height(28.dp))

            // Фичи
            val features = listOf(
                "📊 Аналитика урожая по сезонам",
                "📋 Журнал всех действий",
                "🌿 Рекомендации агронома",
                "🔔 Умные уведомления о поливе",
                "📤 Экспорт данных в CSV",
                "🏡 До 3 участков"
            )
            features.forEach { feature ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Green,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = feature,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = Color(0xFF333333)
                    )
                }
            }

            Spacer(Modifier.height(28.dp))

            // Карточки тарифов
            PlanCard(
                title = "Ежегодная",
                price = "1 990 ₽",
                period = "в год",
                badge = "Выгода 43%",
                monthlyEquiv = "≈ 166 ₽/мес",
                isSelected = selectedPlan == "yearly",
                onClick = { selectedPlan = "yearly" }
            )

            Spacer(Modifier.height(12.dp))

            PlanCard(
                title = "Ежемесячная",
                price = "299 ₽",
                period = "в месяц",
                badge = null,
                monthlyEquiv = null,
                isSelected = selectedPlan == "monthly",
                onClick = { selectedPlan = "monthly" }
            )

            Spacer(Modifier.height(28.dp))

            // Кнопка покупки
            Button(
                onClick = {
                    if (selectedPlan == "yearly") viewModel.purchaseYearly(activity)
                    else viewModel.purchaseMonthly(activity)
                },
                enabled = !uiState.isPurchasing && !uiState.status.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Orange)
            ) {
                if (uiState.isPurchasing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (selectedPlan == "yearly") "Оформить за 1 990 ₽/год" else "Оформить за 299 ₽/мес",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp,
                        softWrap = false
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            // Восстановить покупки
            TextButton(onClick = { viewModel.restorePurchases() }) {
                Text(
                    "Восстановить покупки",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = Color(0xFF888888)
                )
            }

            Spacer(Modifier.height(20.dp))

            // ─── Промокод ───────────────────────────────────────────────
            HorizontalDivider(color = Color(0xFFEADFCB))
            Spacer(Modifier.height(16.dp))

            Text(
                text = "Есть промокод?",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 15.sp,
                color = Color(0xFF1A1A1A)
            )
            Spacer(Modifier.height(10.dp))

            OutlinedTextField(
                value = promoCode,
                onValueChange = {
                    promoCode = it.uppercase()
                    if (uiState.redeemError != null) viewModel.dismissRedeemError()
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !uiState.isRedeeming,
                placeholder = {
                    Text(
                        "DACHA-XXXX-XXXX",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFBBBBBB)
                    )
                },
                textStyle = LocalTextStyle.current.copy(
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold
                ),
                isError = uiState.redeemError != null,
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Orange,
                    cursorColor = Orange
                )
            )

            AnimatedVisibility(visible = uiState.redeemError != null) {
                Text(
                    text = uiState.redeemError ?: "",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                )
            }

            Spacer(Modifier.height(10.dp))

            OutlinedButton(
                onClick = { viewModel.redeemPromo(promoCode) },
                enabled = promoCode.isNotBlank() && !uiState.isRedeeming,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(2.dp, Orange)
            ) {
                if (uiState.isRedeeming) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Orange,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = "Активировать промокод",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = Orange,
                        softWrap = false
                    )
                }
            }

            // Ошибка
            AnimatedVisibility(visible = uiState.error != null) {
                Text(
                    text = uiState.error ?: "",
                    fontFamily = NunitoFamily,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Spacer(Modifier.height(24.dp))

            Text(
                text = "Подписка автоматически продлевается. Отменить можно в любое время через RuStore.",
                fontFamily = NunitoFamily,
                fontSize = 11.sp,
                color = Color(0xFFAAAAAA),
                textAlign = TextAlign.Center,
                lineHeight = 16.sp
            )

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun PlanCard(
    title: String,
    price: String,
    period: String,
    badge: String?,
    monthlyEquiv: String?,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (isSelected) Orange else Color(0xFFE0D5C5)
    val bgColor     = if (isSelected) OrangeLight else Color.White

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = Color(0xFF1A1A1A)
                    )
                    if (badge != null) {
                        Spacer(Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(100.dp))
                                .background(Orange)
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = badge,
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = Color.White
                            )
                        }
                    }
                }
                if (monthlyEquiv != null) {
                    Text(
                        text = monthlyEquiv,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        color = Color(0xFF888888)
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = price,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    color = if (isSelected) Orange else Color(0xFF1A1A1A)
                )
                Text(
                    text = period,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = Color(0xFF888888)
                )
            }
        }
    }
}
