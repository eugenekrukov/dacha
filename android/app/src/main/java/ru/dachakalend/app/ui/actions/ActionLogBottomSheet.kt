package ru.dachakalend.app.ui.actions

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.theme.NunitoFamily
import ru.dachakalend.app.ui.theme.RussoOneFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActionLogBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    onActionLogged: (loggedType: String) -> Unit = {},
    preselectedType: String? = null,
    initialNotes: String? = null,
    viewModel: ActionLogViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var notes by remember { mutableStateOf(initialNotes ?: "") }
    var selectedType by remember { mutableStateOf(preselectedType) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.reset() }
    LaunchedEffect(state.success) {
        if (state.success) {
            // Действие реально записано → сообщаем тип (для корректного снятия pending), затем закрываем.
            onActionLogged(selectedType ?: "")
            sheetState.hide()
            onDismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .imePadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = planting.cropName ?: "Посадка #${planting.id}",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Что сделали?",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Тип действия — 2х2 сетка кнопок
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.height(320.dp)
            ) {
                items(ACTION_TYPES) { (type, label) ->
                    val isSelected = selectedType == type
                    Button(
                        onClick = { selectedType = type },
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = if (isSelected)
                                MaterialTheme.colorScheme.onPrimary
                            else
                                MaterialTheme.colorScheme.onSecondaryContainer
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = actionIcon(type),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            label,
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            softWrap = false
                        )
                    }
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 1,
                maxLines = 3,
                textStyle = TextStyle(
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            )

            state.error?.let {
                Text(
                    it,
                    fontFamily = NunitoFamily,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp
                )
            }

            Button(
                onClick = {
                    selectedType?.let { type ->
                        if (type == "transplanting") {
                            viewModel.logTransplanting(planting.id)
                        } else {
                            // auto = заметка осталась авто-подставленной (имя задачи/удобрения),
                            // пользователь её не менял → в журнале скроем как дубль.
                            val isAuto = !initialNotes.isNullOrBlank() && notes == initialNotes
                            viewModel.logAction(planting.id, type, notes.ifBlank { null }, auto = isAuto)
                        }
                    }
                },
                enabled = selectedType != null && !state.isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        "Сохранить",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        softWrap = false
                    )
                }
            }
        }
    }
}

