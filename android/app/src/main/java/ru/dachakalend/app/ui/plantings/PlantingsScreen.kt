package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import java.time.LocalDate
import java.time.format.DateTimeFormatter

val STAGE_LABELS = mapOf(
    "sowing"     to "Посеяно",
    "sprouted"   to "Проросло",
    "growing"    to "Растёт",
    "flowering"  to "Цветёт",
    "harvesting" to "Созревает",
    "done"       to "Завершено"
)

val STAGE_ORDER = listOf("sowing", "sprouted", "growing", "flowering", "harvesting", "done")

private fun formatIsoDate(iso: String): String = try {
    val date = java.time.OffsetDateTime.parse(iso)
    "%02d.%02d.%02d".format(date.dayOfMonth, date.monthValue, date.year % 100)
} catch (_: Exception) {
    try {
        val date = LocalDate.parse(iso.take(10))
        "%02d.%02d.%02d".format(date.dayOfMonth, date.monthValue, date.year % 100)
    } catch (_: Exception) { iso }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun PlantingsScreen(
    onAddCrop: () -> Unit,
    onCropDetail: (Int) -> Unit = {},
    onOpenCropDetail: (Int) -> Unit = onCropDetail,
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
                        planting     = planting,
                        onLogAction  = { viewModel.openActionSheet(planting) },
                        onEditInfo   = { viewModel.openEditSheet(planting) },
                        onDelete     = { viewModel.requestDelete(planting) },
                        onInfo       = { viewModel.openInfoSheet(planting) }
                    )
                }
            }
        }
    }

    // Шторка журнала действий
    state.showActionSheet?.let { planting ->
        ActionLogBottomSheet(
            planting = planting,
            onDismiss = { viewModel.closeActionSheet() }
        )
    }

    // Шторка настройки новой посадки
    state.pendingCropId?.let { cropId ->
        PlantingSetupBottomSheet(
            onConfirm = { date, qty, cond -> viewModel.confirmPlanting(cropId, date, qty, cond) },
            onDismiss = { viewModel.dismissSetupSheet() }
        )
    }

    // Шторка информации о посадке
    state.showInfoSheet?.let { planting ->
        PlantingInfoBottomSheet(
            planting     = planting,
            onDismiss    = { viewModel.dismissInfoSheet() },
            onCropDetail = { cropId ->
                viewModel.dismissInfoSheet()
                onOpenCropDetail(cropId)
            }
        )
    }

    // Диалог подтверждения удаления
    state.confirmDeletePlanting?.let { planting ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDelete() },
            title = { Text("Удалить посадку?") },
            text = { Text("«${planting.cropName ?: "Посадка"}» будет удалена без возможности восстановления.") },
            confirmButton = {
                TextButton(onClick = { viewModel.confirmDelete(planting.id) }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDelete() }) { Text("Отмена") }
            }
        )
    }

    // Шторка редактирования существующей посадки
    state.editingPlanting?.let { planting ->
        PlantingEditBottomSheet(
            planting = planting,
            onConfirm = { date, qty, cond -> viewModel.saveEditedInfo(planting.id, date, qty, cond) },
            onDismiss = { viewModel.dismissEditSheet() }
        )
    }
}

// ─── Карточка посадки ────────────────────────────────────────────────────────

@Composable
private fun PlantingCard(
    planting: Planting,
    onLogAction: () -> Unit,
    onEditInfo: () -> Unit,
    onDelete: () -> Unit,
    onInfo: () -> Unit
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
                            formatIsoDate(it),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        "Дата последнего действия: ${planting.lastActionAt?.let { formatIsoDate(it) } ?: "—"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
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
                            text = { Text("Редактировать информацию") },
                            onClick = { menuExpanded = false; onEditInfo() }
                        )
                        DropdownMenuItem(
                            text = { Text("Удалить посадку", color = MaterialTheme.colorScheme.error) },
                            onClick = { menuExpanded = false; onDelete() }
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onLogAction, modifier = Modifier.weight(1f)) {
                    Text("📝 Записать действие")
                }
                OutlinedButton(onClick = onInfo) {
                    Text("Информация")
                }
            }
        }
    }
}

// ─── Шторка: настройка новой посадки ────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingSetupBottomSheet(
    onConfirm: (date: String, quantity: Int, conditions: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var date by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    var dateDisplay by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))) }
    var quantity by remember { mutableStateOf("1") }
    var conditions by remember { mutableStateOf("soil") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Параметры посадки", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            // Дата посадки
            OutlinedTextField(
                value = dateDisplay,
                onValueChange = { input ->
                    dateDisplay = input
                    // Парсим DD.MM.YYYY → ISO
                    runCatching {
                        val parts = input.split(".")
                        if (parts.size == 3) {
                            val d = parts[0].toInt(); val m = parts[1].toInt(); val y = parts[2].toInt()
                            date = LocalDate.of(y, m, d).format(DateTimeFormatter.ISO_LOCAL_DATE)
                        }
                    }
                },
                label = { Text("Дата посадки") },
                placeholder = { Text("ДД.ММ.ГГГГ") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Количество
            OutlinedTextField(
                value = quantity,
                onValueChange = { if (it.all(Char::isDigit)) quantity = it },
                label = { Text("Количество растений") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Условия
            Text("Место посадки", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = conditions == "soil",
                    onClick = { conditions = "soil" },
                    label = { Text("🌱 Грунт") }
                )
                FilterChip(
                    selected = conditions == "greenhouse",
                    onClick = { conditions = "greenhouse" },
                    label = { Text("🏠 Теплица") }
                )
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    onConfirm(date, quantity.toIntOrNull() ?: 1, conditions)
                },
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text("🌱 Посадить", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

// ─── Шторка: редактирование существующей посадки ─────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingEditBottomSheet(
    planting: Planting,
    onConfirm: (date: String, quantity: Int, conditions: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Инициализируем из текущих данных посадки
    val initialDate = planting.sownAt?.take(10) ?: LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
    val initialDateDisplay = runCatching {
        val ld = LocalDate.parse(initialDate)
        ld.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
    }.getOrElse { initialDate }

    var date by remember { mutableStateOf(initialDate) }
    var dateDisplay by remember { mutableStateOf(initialDateDisplay) }
    var quantity by remember { mutableStateOf((planting.quantity ?: 1).toString()) }
    var conditions by remember { mutableStateOf(planting.conditions ?: "soil") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Редактировать: ${planting.cropName ?: "посадку"}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            // Дата посадки
            OutlinedTextField(
                value = dateDisplay,
                onValueChange = { input ->
                    dateDisplay = input
                    runCatching {
                        val parts = input.split(".")
                        if (parts.size == 3) {
                            val d = parts[0].toInt(); val m = parts[1].toInt(); val y = parts[2].toInt()
                            date = LocalDate.of(y, m, d).format(DateTimeFormatter.ISO_LOCAL_DATE)
                        }
                    }
                },
                label = { Text("Дата посадки") },
                placeholder = { Text("ДД.ММ.ГГГГ") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Количество
            OutlinedTextField(
                value = quantity,
                onValueChange = { if (it.all(Char::isDigit)) quantity = it },
                label = { Text("Количество растений") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Условия
            Text("Место посадки", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = conditions == "soil",
                    onClick = { conditions = "soil" },
                    label = { Text("🌱 Грунт") }
                )
                FilterChip(
                    selected = conditions == "greenhouse",
                    onClick = { conditions = "greenhouse" },
                    label = { Text("🏠 Теплица") }
                )
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { onConfirm(date, quantity.toIntOrNull() ?: 1, conditions) },
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text("Сохранить", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
