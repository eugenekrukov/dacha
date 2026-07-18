package ru.dachakalend.app.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.BuildConfig
import ru.dachakalend.app.ui.theme.NunitoFamily

/** ISO-дата ("2026-07-04T00:00:00.000Z") → "04.07.2026". null/ошибка → null. */
fun formatPromoDate(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return try {
        val d = java.time.OffsetDateTime.parse(iso)
        "%02d.%02d.%04d".format(d.dayOfMonth, d.monthValue, d.year)
    } catch (_: Exception) {
        try {
            val d = java.time.LocalDate.parse(iso.take(10))
            "%02d.%02d.%04d".format(d.dayOfMonth, d.monthValue, d.year)
        } catch (_: Exception) { null }
    }
}

// Данные аккаунта и участка переехали в «Профиль» → вкладка «Аккаунт» (см. AccountSection).
// «Настройки» = системные параметры: подписка, внешний вид, уведомления, о приложении.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onOpenPaywall: (() -> Unit)? = null,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val settings  by viewModel.settings.collectAsState()
    val subStatus by viewModel.subscriptionStatus.collectAsState()
    val largeFont by viewModel.largeFont.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text("Настройки", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onBackground)
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // ─── Подписка — только в платных сборках (PAYMENTS_ENABLED: rustore, gplay) ───
            if (BuildConfig.PAYMENTS_ENABLED) {
            Text("ПОДПИСКА", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (subStatus.isSubscribed || subStatus.isPromo) androidx.compose.ui.graphics.Color(0xFFE8F5E9)
                                     else if (subStatus.isTrialActive) androidx.compose.ui.graphics.Color(0xFFFFF3E0)
                                     else MaterialTheme.colorScheme.errorContainer
                ),
                elevation = CardDefaults.cardElevation(0.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = when {
                                subStatus.isSubscribed  -> "Дачник Про"
                                subStatus.isPromo       -> "Дачник Про"
                                subStatus.isTrialActive -> "Пробный период"
                                else                    -> "Подписка истекла"
                            },
                            fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 15.sp
                        )
                        Text(
                            text = when {
                                subStatus.isSubscribed     -> "Активна" +
                                    (formatPromoDate(subStatus.subscriptionUntil)?.let { " до $it" } ?: "")
                                subStatus.isPromoLifetime  -> "Доступ навсегда (промокод)"
                                subStatus.isPromo          -> "Доступ по промокоду" +
                                    (formatPromoDate(subStatus.promoUntil)?.let { " до $it" } ?: "")
                                subStatus.isTrialActive    -> "Осталось ${subStatus.trialDaysLeft} дн."
                                else                       -> "Оформите подписку"
                            },
                            fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (!subStatus.isSubscribed) {
                        TextButton(onClick = { onOpenPaywall?.invoke() }) {
                            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(16.dp),
                                tint = androidx.compose.ui.graphics.Color(0xFFFF7B00))
                            Spacer(Modifier.width(4.dp))
                            Text("Купить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                                color = androidx.compose.ui.graphics.Color(0xFFFF7B00))
                        }
                    }
                }
            }

            if (subStatus.isSubscribed) {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 16.dp)) {
                        Text(
                            if (subStatus.autoRenew) "Автопродление" else "Срок подписки",
                            fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = if (subStatus.autoRenew)
                                "Подписка продлится автоматически" +
                                    (formatPromoDate(subStatus.subscriptionUntil)?.let { " $it" } ?: "")
                            else "Действует до " + (formatPromoDate(subStatus.subscriptionUntil) ?: "—") +
                                " · продлите повторной оплатой",
                            fontFamily = NunitoFamily, fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (subStatus.autoRenew) {
                        Switch(checked = true, onCheckedChange = { if (!it) viewModel.cancelAutoRenew() })
                    } else {
                        TextButton(onClick = { onOpenPaywall?.invoke() }) {
                            Text("Продлить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                                color = androidx.compose.ui.graphics.Color(0xFFFF7B00))
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            } // конец блока подписки (PAYMENTS_ENABLED)

            Text("ВНЕШНИЙ ВИД", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))
            NotificationToggle("Крупный шрифт", "Увеличивает текст по всему приложению", largeFont, viewModel::setLargeFont)

            Spacer(Modifier.height(16.dp))

            Text("УВЕДОМЛЕНИЯ", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))
            NotificationToggle("Угроза заморозков", "Предупреждение при температуре ≤ 2°C", settings.frost, viewModel::setFrost)
            HorizontalDivider()
            NotificationToggle("Сильная жара", "Предупреждение при температуре ≥ 35°C", settings.heat, viewModel::setHeat)
            HorizontalDivider()
            NotificationToggle("Нужен полив", "Напоминание о просроченном поливе", settings.watering, viewModel::setWatering)
            HorizontalDivider()
            NotificationToggle("Нужна подкормка", "Напоминание о просроченной подкормке", settings.fertilizing, viewModel::setFertilizing)
            HorizontalDivider()
            NotificationToggle("Пора пересаживать", "Рассада 14+ дней — готова к высадке в грунт", settings.transplant, viewModel::setTransplant)

            Spacer(Modifier.height(16.dp))

            Text("О ПРИЛОЖЕНИИ", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))
            Text("Версия ${BuildConfig.VERSION_NAME}", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp))
            val openUrl = { url: String ->
                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            }
            SettingsActionRow("Публичная оферта") { openUrl("https://dacha.studio1008.com/offer") }
            HorizontalDivider()
            SettingsActionRow("Политика конфиденциальности") { openUrl("https://dacha.studio1008.com/privacy") }
            HorizontalDivider()
            SettingsActionRow("Удаление аккаунта и данных") { openUrl("https://dacha.studio1008.com/account-deletion") }
            HorizontalDivider()
            SettingsActionRow("Поддержка: dacha@studio1008.com") { openUrl("mailto:dacha@studio1008.com") }
            HorizontalDivider()
            SettingsActionRow("Мы в ВКонтакте") { openUrl("https://vk.ru/calendacha") }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun NotificationToggle(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 16.dp)) {
            Text(title, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onBackground)
            Text(description, fontFamily = NunitoFamily, fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsActionRow(title: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(title, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
            color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground)
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
