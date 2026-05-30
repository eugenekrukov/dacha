package ru.dachakalend.app.ui.actions

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Planting

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActionLogBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    viewModel: ActionLogViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var notes by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf<String?>(null) }

    // Закрываем после успеха
    LaunchedEffect(state.success) {
        if (state.success) onDismiss()
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()  // отступ под системную навигацию (жесты / кнопки)
                .imePadding()             // отступ при появлении клавиатуры
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = planting.cropName ?: "Посадка #${planting.id}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Что сделали?",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Тип действия — 2х2 сетка кнопок (1 тап)
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.height(130.dp)
            ) {
                items(ACTION_TYPES) { (type, label) ->
                    val isSelected = selectedType == type
                    Button(
                        onClick = { selectedType = type },
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
                        Text(label)
                    }
                }
            }

            // Опциональная заметка
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 2
            )

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall)
            }

            // Сохранить (тап 2-3)
            Button(
                onClick = {
                    selectedType?.let { type ->
                        viewModel.logAction(planting.id, type, notes.ifBlank { null })
                    }
                },
                enabled = selectedType != null && !state.isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Сохранить", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}
