package ru.dachakalend.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Промежуточный экран «Начать без регистрации»: создаёт гостевую учётку и уводит к участку
 * (или сразу на «Сегодня», если у этого гостя участок уже есть). Виден только при ошибке сети.
 */
@Composable
fun GuestStartScreen(
    onNeedGarden: () -> Unit,
    onHasGarden: () -> Unit,
    onLogin: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.startGuest() }
    LaunchedEffect(state) {
        when (state) {
            AuthUiState.SuccessNoGarden -> onNeedGarden()
            AuthUiState.SuccessHasGarden -> onHasGarden()
            else -> Unit
        }
    }

    Box(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        val error = (state as? AuthUiState.Error)?.message
        if (error == null) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(error, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                    textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onBackground)
                Button(
                    onClick = { viewModel.startGuest() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Text("Повторить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                }
                TextButton(onClick = onLogin) {
                    Text("Войти по email", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
