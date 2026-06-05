package ru.dachakalend.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.NunitoFamily

@Composable
fun VerifyEmailScreen(
    email: String?,
    onVerified: () -> Unit,
    onSkip: (() -> Unit)? = null,
    viewModel: VerifyEmailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var code by remember { mutableStateOf("") }

    LaunchedEffect(uiState.verified) {
        if (uiState.verified) onVerified()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("📬", fontSize = 56.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Подтвердите email",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 24.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            buildString {
                append("Мы отправили 6-значный код")
                if (!email.isNullOrBlank()) append(" на $email")
            },
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = code,
            onValueChange = { if (it.length <= 6 && it.all(Char::isDigit)) code = it },
            label = { Text("Код из письма", fontFamily = NunitoFamily) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
            shape = RoundedCornerShape(12.dp)
        )

        if (uiState.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(uiState.error!!, fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        if (uiState.resentMessage != null) {
            Spacer(Modifier.height(8.dp))
            Text(uiState.resentMessage!!, fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.tertiary, fontSize = 13.sp)
        }

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = { viewModel.verify(code) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            enabled = !uiState.isLoading
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            } else {
                Text("Подтвердить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false)
            }
        }

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = { viewModel.resend() }, enabled = !uiState.isLoading) {
            Text("Отправить код повторно", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
        }

        if (onSkip != null) {
            TextButton(onClick = onSkip) {
                Text("Позже", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
