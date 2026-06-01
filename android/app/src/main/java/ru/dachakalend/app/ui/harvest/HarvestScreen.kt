package ru.dachakalend.app.ui.harvest

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Harvest
import ru.dachakalend.app.data.model.Planting

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HarvestScreen(
    onAddPlanting: () -> Unit = {},
    viewModel: HarvestViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }
    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.openAddSheet() }) {
                Icon(Icons.Default.Add, contentDescription = "Добавить урожай")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.harvests.isEmpty() -> EmptyHarvestState(
                    modifier = Modifier.align(Alignment.Center),
                    onAddPlanting = onAddPlanting
                )
                else -> HarvestList(harvests = state.harvests)
            }
        }
    }

    if (state.showAddSheet) {
        AddHarvestSheet(
            plantings = state.plantings,
            isSaving = state.isSaving,
            onDismiss = { viewModel.closeAddSheet() },
            onSave = { plantingId, weightKg, quantity, notes ->
                viewModel.addHarvest(plantingId, weightKg, quantity, notes)
            }
        )
    }
}

@Composable
private fun EmptyHarvestState(
    modifier: Modifier = Modifier,
    onAddPlanting: () -> Unit = {}
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("🌾", style = MaterialTheme.typography.displayMedium)
        Text(
            "Урожай пока не записан",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            "Сначала добавьте посадку, затем фиксируйте сбор урожая",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(8.dp))
        Button(onClick = onAddPlanting) {
            Text("Добавить посадку")
        }
    }
}

@Composable
private fun HarvestList(harvests: List<Harvest>) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            HarvestSummaryCard(harvests)
        }
        item {
            HarvestByCropCard(harvests)
        }
        items(harvests, key = { it.id }) { harvest ->
            HarvestCard(harvest)
        }
    }
}

@Composable
private fun HarvestSummaryCard(harvests: List<Harvest>) {
    val totalKg = harvests.mapNotNull { it.weightKg }.sum()
    val totalPcs = harvests.mapNotNull { it.quantity }.sum()

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (totalKg > 0) "%.1f кг".format(totalKg) else "—",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "всего вес",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (totalPcs > 0) "$totalPcs шт" else "—",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "всего штук",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "${harvests.size}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "записей",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun HarvestByCropCard(harvests: List<Harvest>) {
    if (harvests.isEmpty()) return

    // Группируем по cropName
    val grouped = harvests.groupBy { it.cropName ?: "Без названия" }
        .map { (cropName, items) ->
            Triple(
                cropName,
                items.mapNotNull { it.weightKg }.sum(),
                items.mapNotNull { it.quantity }.sum()
            )
        }
        .sortedByDescending { it.second + it.third }

    var expanded by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "По культурам",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                TextButton(onClick = { expanded = !expanded }) {
                    Text(if (expanded) "Свернуть" else "Развернуть")
                }
            }
            if (expanded) {
                grouped.forEach { (cropName, kg, pcs) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(cropName, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        Text(
                            buildString {
                                if (kg > 0) append("%.1f кг".format(kg))
                                if (kg > 0 && pcs > 0) append(" · ")
                                if (pcs > 0) append("$pcs шт")
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    HorizontalDivider(thickness = 0.5.dp)
                }
            }
        }
    }
}

@Composable
private fun HarvestCard(harvest: Harvest) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("🌾", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = harvest.cropName ?: "Посадка #${harvest.plantingId}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                val detail = buildString {
                    harvest.weightKg?.let { append("%.1f кг".format(it)) }
                    harvest.quantity?.let {
                        if (isNotEmpty()) append(" · ")
                        append("$it шт")
                    }
                    harvest.notes?.let {
                        if (isNotEmpty()) append(" · ")
                        append(it)
                    }
                }
                if (detail.isNotEmpty()) {
                    Text(
                        text = detail,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Text(
                text = harvest.harvestedAt.take(10),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddHarvestSheet(
    plantings: List<Planting>,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?) -> Unit
) {
    var selectedPlanting by remember { mutableStateOf(plantings.firstOrNull()) }
    var weightText by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var dropdownExpanded by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Записать урожай",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            ExposedDropdownMenuBox(
                expanded = dropdownExpanded,
                onExpandedChange = { dropdownExpanded = it }
            ) {
                OutlinedTextField(
                    value = selectedPlanting?.cropName
                        ?: selectedPlanting?.let { "Посадка #${it.id}" }
                        ?: "Нет посадок",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Культура") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(dropdownExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = dropdownExpanded,
                    onDismissRequest = { dropdownExpanded = false }
                ) {
                    plantings.forEach { planting ->
                        DropdownMenuItem(
                            text = { Text(planting.cropName ?: "Посадка #${planting.id}") },
                            onClick = {
                                selectedPlanting = planting
                                dropdownExpanded = false
                            }
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = weightText,
                    onValueChange = { weightText = it },
                    label = { Text("Вес, кг") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Штук") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)") },
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val pid = selectedPlanting?.id ?: return@Button
                    onSave(
                        pid,
                        weightText.toDoubleOrNull(),
                        quantityText.toIntOrNull(),
                        notes.ifBlank { null }
                    )
                },
                enabled = selectedPlanting != null && !isSaving &&
                        (weightText.toDoubleOrNull() != null || quantityText.toIntOrNull() != null),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Сохранить")
                }
            }
        }
    }
}
