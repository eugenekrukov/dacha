package ru.dachakalend.app.ui.paywall

import android.net.Uri
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.R
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
    var selectedPlan by remember { mutableStateOf("yearly") }
    var promoCode by remember { mutableStateOf("") }
    // Был ли запущен платёж — чтобы по возвращении из Custom Tab опросить сервер (вебхук).
    var paymentStarted by remember { mutableStateOf(false) }

    // Навигация — ТОЛЬКО по явному событию выдачи доступа (оплата/промокод).
    // Не по ambient-статусу: иначе экран, открытый из настроек при активном доступе, сразу закрывался бы.
    LaunchedEffect(uiState.accessGranted) {
        if (uiState.accessGranted) {
            uiState.redeemMessage?.let { Toast.makeText(context, it, Toast.LENGTH_LONG).show() }
            onAccessGranted()
        }
    }

    // Открываем ссылку оплаты ЮKassa в Chrome Custom Tab.
    LaunchedEffect(uiState.paymentUrl) {
        uiState.paymentUrl?.let { url ->
            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
            viewModel.onPaymentLaunched()
            paymentStarted = true
        }
    }

    // По возвращении в приложение (закрыли Custom Tab) — опрашиваем статус: вебхук мог выдать доступ.
    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME && paymentStarted) {
                paymentStarted = false
                viewModel.checkAfterPayment()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
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
                Image(
                    painter = painterResource(R.drawable.ic_sunflower_png),
                    contentDescription = null,
                    modifier = Modifier.size(52.dp)
                )
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
                text = "Без ограничения на число посадок\nи с расширенным лимитом фото",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = Color(0xFF666666),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp
            )

            // U7 ценностный блок — прогресс остаётся с вами и на бесплатном тарифе.
            if (uiState.plantingsCount > 0 || uiState.actionsCount > 0) {
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(OrangeLight)
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Вы уже добавили ${plural(uiState.plantingsCount, "посадку", "посадки", "посадок")} " +
                            "и записали ${plural(uiState.actionsCount, "действие", "действия", "действий")} " +
                            "— всё это остаётся с вами и на бесплатном тарифе." +
                            if (uiState.plantingsCount >= uiState.status.plantingsLimit)
                                " Достигнут лимит одновременных посадок — «Дачник Про» снимает его."
                            else "",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = Color(0xFF2D1500),
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )
                }
            }

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
            } else if (!uiState.status.isSubscribed) {
                // Бейдж бесплатного тарифа (бессрочно, лимит по числу посадок)
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(100.dp))
                        .background(Green)
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Бесплатно навсегда: 1 сад, до ${uiState.status.plantingsLimit} посадок",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color.White
                    )
                }
            }

            Spacer(Modifier.height(28.dp))

            // Фичи — сверх бесплатного тарифа
            val features = listOf(
                "Неограниченное число посадок",
                "До 30 фото на посадку вместо 3",
                "Поддержка развития приложения"
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
                badge = "Выгода 45%",
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
                onClick = { viewModel.purchase(selectedPlan) },
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
                text = "Оплата банковской картой через ЮKassa. Доступ открывается на оплаченный период; продление — повторной оплатой.",
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

/** Русское склонение по числу: 1 посадку / 2 посадки / 5 посадок. */
private fun plural(n: Int, one: String, few: String, many: String): String {
    val m10 = n % 10
    val m100 = n % 100
    val word = when {
        m10 == 1 && m100 != 11 -> one
        m10 in 2..4 && (m100 < 10 || m100 >= 20) -> few
        else -> many
    }
    return "$n $word"
}
