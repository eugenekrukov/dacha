package ru.dachakalend.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.NunitoFamily
import ru.dachakalend.app.ui.theme.RussoOneFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onOpenPaywall: (() -> Unit)? = null,
    onOpenAnalytics: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val settings      by viewModel.settings.collectAsState()
    val loggedOut     by viewModel.loggedOut.collectAsState()
    val subStatus     by viewModel.subscriptionStatus.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }

    LaunchedEffect(loggedOut) {
        if (loggedOut) onLogout()
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = {
                Text(
                    "Выйти из аккаунта?",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black
                )
            },
            text = {
                Text(
                    "Все данные приложения будут очищены на этом устройстве. Посадки и история останутся на сервере.",
                    fontFamily = NunitoFamily
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.logout() }) {
                    Text(
                        "Выйти",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Отмена", fontFamily = NunitoFamily)
                }
            }
        )
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Настройки",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
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
            // ─── Блок подписки ────────────────────────────────────────────────────
            Text(
                text = "ПОДПИСКА",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                colors = androidx.compose.material3.CardDefaults.cardColors(
                    containerColor = if (subStatus.isSubscribed || subStatus.isPromo) androidx.compose.ui.graphics.Color(0xFFE8F5E9)
                                     else if (subStatus.isTrialActive) androidx.compose.ui.graphics.Color(0xFFFFF3E0)
                                     else MaterialTheme.colorScheme.errorContainer
                ),
                elevation = androidx.compose.material3.CardDefaults.cardElevation(0.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = when {
                                subStatus.isSubscribed  -> "Дачник Про ✓"
                                subStatus.isPromo       -> "Дачник Про ✓"
                                subStatus.isTrialActive -> "Пробный период"
                                else                    -> "Подписка истекла"
                            },
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp
                        )
                        Text(
                            text = when {
                                subStatus.isSubscribed     -> "Подписка активна"
                                subStatus.isPromoLifetime  -> "Доступ навсегда (промокод)"
                                subStatus.isPromo          -> "Доступ по промокоду"
                                subStatus.isTrialActive    -> "Осталось ${subStatus.trialDaysLeft} дн."
                                else                       -> "Оформите подписку"
                            },
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // Кнопку «Купить» прячем при любом активном доступе (подписка или промокод)
                    if (!subStatus.isSubscribed && !subStatus.isPromo) {
                        TextButton(onClick = { onOpenPaywall?.invoke() }) {
                            Icon(
                                Icons.Default.Star,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = androidx.compose.ui.graphics.Color(0xFFFF7B00)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Купить",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Black,
                                color = androidx.compose.ui.graphics.Color(0xFFFF7B00)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            Text(
                text = "УВЕДОМЛЕНИЯ",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )

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

            // ─── Блок данных ──────────────────────────────────────────────────────
            Text(
                text = "ДАННЫЕ",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onOpenAnalytics),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(0.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Insights,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Статистика и история",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            "Серия дней, активность, экспорт в CSV",
                            fontFamily = NunitoFamily,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Icon(
                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            OutlinedButton(
                onClick = { showLogoutDialog = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
            ) {
                Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Выйти из аккаунта",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold
                )
            }
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
            Text(
                text = title,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = description,
                fontFamily = NunitoFamily,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

