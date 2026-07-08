package ru.dachakalend.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.MarkEmailUnread
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Блок «Аккаунт + участок + выход». Переехал из «Настроек» на вкладку «Аккаунт» экрана «Профиль»
 * (чтобы «Профиль» соответствовал названию). Логика — общий [SettingsViewModel].
 */
@Composable
fun AccountSection(
    gardenName: String?,
    gardenRegion: String?,
    onVerifyEmail: (email: String?) -> Unit,
    onEditGarden: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val loggedOut by viewModel.loggedOut.collectAsState()
    val emailVerified by viewModel.emailVerified.collectAsState()
    val email by viewModel.email.collectAsState()
    val pendingEmail by viewModel.pendingEmail.collectAsState()
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
    LaunchedEffect(loggedOut) { if (loggedOut) onLogout() }

    // Перечитываем профиль при возврате (например, после подтверждения email).
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
            title = { Text("Выйти из аккаунта?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Text(
                    "Все данные приложения будут очищены на этом устройстве. Посадки и история останутся на сервере.",
                    fontFamily = NunitoFamily
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.logout() }) {
                    Text("Выйти", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Отмена", fontFamily = NunitoFamily) }
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
                        visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(next, { next = it }, label = { Text("Новый пароль (мин. 6)") },
                        visualTransformation = PasswordVisualTransformation(), singleLine = true)
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
                        visualTransformation = PasswordVisualTransformation(), singleLine = true)
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
                        visualTransformation = PasswordVisualTransformation(), singleLine = true)
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (emailVerified == false) {
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onVerifyEmail(email) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0)),
                elevation = CardDefaults.cardElevation(0.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.MarkEmailUnread, contentDescription = null,
                        modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Подтвердите email", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                            fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
                        Text("Нужно для восстановления доступа к аккаунту", fontFamily = NunitoFamily,
                            fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        // ─── Аккаунт ───
        Text("АККАУНТ", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))
        email?.let {
            Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 4.dp))
        }
        pendingEmail?.let {
            Text("Ожидает подтверждения: $it", fontFamily = NunitoFamily, fontSize = 12.sp,
                color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 4.dp))
        }
        AccountActionRow("Сменить пароль") { showPasswordDialog = true }
        HorizontalDivider()
        AccountActionRow("Сменить email") { showEmailDialog = true }
        HorizontalDivider()
        AccountActionRow("Удалить аккаунт", danger = true) { showDeleteDialog = true }
        Spacer(Modifier.height(16.dp))

        // ─── Участок ───
        if (!gardenName.isNullOrBlank()) {
            Text("УЧАСТОК", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(vertical = 8.dp))
            Text(gardenName, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground)
            gardenRegion?.takeIf { it.isNotBlank() }?.let {
                Text(it, fontFamily = NunitoFamily, fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            AccountActionRow("Редактировать участок", onClick = onEditGarden)
            Spacer(Modifier.height(16.dp))
        }

        OutlinedButton(
            onClick = { showLogoutDialog = true },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Выйти из аккаунта", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun AccountActionRow(title: String, danger: Boolean = false, onClick: () -> Unit) {
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
