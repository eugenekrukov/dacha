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
import androidx.compose.material.icons.filled.MarkEmailUnread
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onOpenPaywall: (() -> Unit)? = null,
    onOpenAnalytics: () -> Unit = {},
    onVerifyEmail: (email: String?) -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val settings      by viewModel.settings.collectAsState()
    val loggedOut     by viewModel.loggedOut.collectAsState()
    val subStatus     by viewModel.subscriptionStatus.collectAsState()
    val emailVerified by viewModel.emailVerified.collectAsState()
    val email         by viewModel.email.collectAsState()
    val largeFont     by viewModel.largeFont.collectAsState()
    val pendingEmail  by viewModel.pendingEmail.collectAsState()
    val accountMessage by viewModel.accountMessage.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var showEmailDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(accountMessage) {
        accountMessage?.let {
            android.widget.Toast.makeText(context, it, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearAccountMessage()
        }
    }

    LaunchedEffect(loggedOut) {
        if (loggedOut) onLogout()
    }

    // Перечитываем профиль при возврате на экран (например, после подтверждения email).
    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) viewModel.loadProfile()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
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

    if (showPasswordDialog) {
        var current by remember { mutableStateOf("") }
        var next by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showPasswordDialog = false },
            title = { Text("Смена пароля", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    OutlinedTextField(current, { current = it }, label = { Text("Текущий пароль") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(next, { next = it }, label = { Text("Новый пароль (мин. 6)") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                }
            },
            confirmButton = {
                TextButton(enabled = current.isNotBlank() && next.length >= 6,
                    onClick = { viewModel.changePassword(current, next) { showPasswordDialog = false } }) {
                    Text("Сменить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showPasswordDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }

    if (showEmailDialog) {
        var stepCode by remember { mutableStateOf(false) }
        var newEmail by remember { mutableStateOf("") }
        var pass by remember { mutableStateOf("") }
        var code by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showEmailDialog = false },
            title = { Text("Смена email", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                if (!stepCode) Column {
                    OutlinedTextField(newEmail, { newEmail = it }, label = { Text("Новый email") }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(pass, { pass = it }, label = { Text("Текущий пароль") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                } else Column {
                    Text("Код отправлен на $newEmail", fontFamily = NunitoFamily, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(code, { code = it }, label = { Text("Код из письма") }, singleLine = true)
                }
            },
            confirmButton = {
                if (!stepCode) TextButton(enabled = newEmail.isNotBlank() && pass.isNotBlank(),
                    onClick = { viewModel.changeEmail(newEmail, pass) { stepCode = true } }) {
                    Text("Отправить код", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                } else TextButton(enabled = code.isNotBlank(),
                    onClick = { viewModel.confirmEmailChange(code) { showEmailDialog = false } }) {
                    Text("Подтвердить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { showEmailDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }

    if (showDeleteDialog) {
        var pass by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Удалить аккаунт?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.error) },
            text = {
                Column {
                    Text("Это действие необратимо. Будут удалены участки, посадки, журнал и история.",
                        fontFamily = NunitoFamily)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(pass, { pass = it }, label = { Text("Пароль для подтверждения") },
                        visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), singleLine = true)
                }
            },
            confirmButton = {
                TextButton(enabled = pass.isNotBlank(),
                    onClick = { viewModel.deleteAccount(pass) { showDeleteDialog = false } }) {
                    Text("Удалить навсегда", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) } }
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
            // ─── Баннер подтверждения email (только если email не подтверждён) ─────
            if (emailVerified == false) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onVerifyEmail(email) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
                    elevation = CardDefaults.cardElevation(0.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.MarkEmailUnread,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Подтвердите email",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Black,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                            Text(
                                "Нужно для восстановления доступа к аккаунту",
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
                Spacer(Modifier.height(8.dp))
            }

            // ─── Блок «Аккаунт» ───────────────────────────────────────────────────
            Text(
                text = "АККАУНТ",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            email?.let {
                Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp))
            }
            pendingEmail?.let {
                Text("Ожидает подтверждения: $it", fontFamily = NunitoFamily, fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 4.dp))
            }
            SettingsActionRow("Сменить пароль") { showPasswordDialog = true }
            HorizontalDivider()
            SettingsActionRow("Сменить email") { showEmailDialog = true }
            HorizontalDivider()
            SettingsActionRow("Удалить аккаунт", danger = true) { showDeleteDialog = true }
            Spacer(Modifier.height(16.dp))

            // ─── Блок подписки — только в платных сборках (rustore); в gplay/samsung оплаты нет ───
            if (BuildConfig.PAYMENTS_ENABLED) {
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
                                subStatus.isSubscribed  -> "Дачник Про"
                                subStatus.isPromo       -> "Дачник Про"
                                subStatus.isTrialActive -> "Пробный период"
                                else                    -> "Подписка истекла"
                            },
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp
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
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // «Купить» доступна и во время промо — подписку можно оформить заранее.
                    // Скрываем только при активной подписке.
                    if (!subStatus.isSubscribed) {
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

            // При активной подписке: рекуррент (autoRenew) → тоггл автопродления; разовая оплата
            // (самозанятый, рекуррент у магазина недоступен) → срок + кнопка «Продлить» вручную.
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
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = if (subStatus.autoRenew)
                                "Подписка продлится автоматически" +
                                    (formatPromoDate(subStatus.subscriptionUntil)?.let { " $it" } ?: "")
                            else "Действует до " + (formatPromoDate(subStatus.subscriptionUntil) ?: "—") +
                                " · продлите повторной оплатой",
                            fontFamily = NunitoFamily,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (subStatus.autoRenew) {
                        Switch(
                            checked = true,
                            onCheckedChange = { if (!it) viewModel.cancelAutoRenew() }
                        )
                    } else {
                        TextButton(onClick = { onOpenPaywall?.invoke() }) {
                            Text(
                                "Продлить",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Black,
                                color = androidx.compose.ui.graphics.Color(0xFFFF7B00)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            } // конец блока подписки (PAYMENTS_ENABLED)

            Text(
                text = "ВНЕШНИЙ ВИД",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            NotificationToggle(
                "Крупный шрифт",
                "Увеличивает текст по всему приложению",
                largeFont,
                viewModel::setLargeFont
            )

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

            Spacer(Modifier.height(16.dp))

            // ─── Блок «О приложении» ──────────────────────────────────────────────
            Text(
                text = "О ПРИЛОЖЕНИИ",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(vertical = 8.dp)
            )
            Text(
                "Версия ${BuildConfig.VERSION_NAME}",
                fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp)
            )
            val openUrl = { url: String ->
                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            }
            SettingsActionRow("Пользовательское соглашение") { openUrl("https://dacha.studio1008.com/#legal") }
            HorizontalDivider()
            SettingsActionRow("Политика конфиденциальности") { openUrl("https://dacha.studio1008.com/#legal") }
            HorizontalDivider()
            SettingsActionRow("Поддержка: dacha@studio1008.com") { openUrl("mailto:dacha@studio1008.com") }

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

@Composable
private fun SettingsActionRow(title: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
            color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onBackground
        )
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

