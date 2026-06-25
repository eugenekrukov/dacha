package ru.dachakalend.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.NunitoFamily

@Composable
fun PasswordResetScreen(
    onDone: () -> Unit,
    onBack: () -> Unit,
    viewModel: PasswordResetViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var email           by remember { mutableStateOf("") }
    var code            by remember { mutableStateOf("") }
    var password        by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.done) {
        if (uiState.done) onDone()
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
        Icon(Icons.Default.Key, contentDescription = null,
            tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(8.dp))
        Text(
            "Сброс пароля",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 24.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            when (uiState.step) {
                ResetStep.REQUEST_CODE        -> "Введите email — пришлём код для сброса"
                ResetStep.ENTER_NEW_PASSWORD  -> "Введите код из письма и новый пароль"
            },
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email", fontFamily = NunitoFamily) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = uiState.step == ResetStep.REQUEST_CODE,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
            shape = RoundedCornerShape(12.dp)
        )

        if (uiState.step == ResetStep.ENTER_NEW_PASSWORD) {
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = code,
                onValueChange = { if (it.length <= 6 && it.all(Char::isDigit)) code = it },
                label = { Text("Код из письма", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Next),
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Новый пароль", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                shape = RoundedCornerShape(12.dp),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility, null)
                    }
                }
            )
        }

        if (uiState.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(uiState.error!!, fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = {
                when (uiState.step) {
                    ResetStep.REQUEST_CODE       -> viewModel.requestCode(email)
                    ResetStep.ENTER_NEW_PASSWORD -> viewModel.resetPassword(email, code, password)
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
            enabled = !uiState.isLoading
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            } else {
                Text(
                    when (uiState.step) {
                        ResetStep.REQUEST_CODE       -> "Получить код"
                        ResetStep.ENTER_NEW_PASSWORD -> "Сбросить пароль"
                    },
                    fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = {
            if (uiState.step == ResetStep.ENTER_NEW_PASSWORD) viewModel.backToRequest() else onBack()
        }) {
            Text(
                if (uiState.step == ResetStep.ENTER_NEW_PASSWORD) "Изменить email" else "Назад ко входу",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
            )
        }
    }
}
