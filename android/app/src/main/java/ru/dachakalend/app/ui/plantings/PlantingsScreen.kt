package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.actions.ActionLogBottomSheet

val STAGE_LABELS = mapOf(
    "sowing" to "Посеяно",
    "sprouted" to "Проросло",
    "growing" to "Растёт",
    "flowering" to "Цветёт",
    "harvesting" to "Созревает",
    "done" to "Завершено"
)

val STAGE_ORDER = listOf("sowing", "sprouted", "growing", "flowering", "harvesting", "done")

@Composable
fun PlantingsScreen(
    onAddCrop: () -> Unit,
    onCropDetail: (Int) -> Unit = {},
    viewModel: PlantingsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = onAddCrop) {
                Icon(Icons.Default.Add, contentDescription = "Добавить посадку")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        when {
            state.isLoading -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            state.plantings.isEmpty() -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Посадок пока нет", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Нажмите + чтобы добавить первую культуру",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.plantings, key = { it.id }) { planting ->
                    PlantingCard(
                        planting = planting,
                        onLogAction = { viewModel.openActionSheet(planting) },
                        onNextStage = {
                            val currentIdx = STAGE_ORDER.indexOf(planting.stage)
                            val next = STAGE_ORDER.getOrNull(currentIdx + 1)
                            if (next != null) viewModel.updateStage(planting.id, next)
                        },
                        onCropDetail = { onCropDetail(planting.cropId) }
                    )
                }
            }
        }
    }

    // Bottom Sheet журнала действий
    state.showActionSheet?.let { planting ->
        ActionLogBottomSheet(
            planting = planting,
            onDismiss = { viewModel.closeActionSheet() }
        )
    }
}

@Composable
private fun PlantingCard(
    planting: Planting,
    onLogAction: () -> Unit,
    onNextStage: () -> Unit,
    onCropDetail: () -> Unit = {}
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        planting.cropName ?: "Культура #${planting.cropId}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        STAGE_LABELS[planting.stage] ?: planting.stage,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    planting.sownAt?.let {
                        Text(
                            "Посеяно: $it",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Box {
                    IconButton(onClick = { menuExpanded = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Меню")
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Следующий этап") },
                            onClick = { menuExpanded = false; onNextStage() }
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onLogAction, modifier = Modifier.weight(1f)) {
                    Text("📝 Записать действие")
                }
                OutlinedButton(onClick = onCropDetail) {
                    Text("О культуре")
                }
            }
        }
    }
}
