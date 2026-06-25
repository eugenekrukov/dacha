package ru.dachakalend.app.ui.harvest

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ShoppingBasket
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Harvest
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.theme.NunitoFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HarvestScreen(
    onAddPlanting: () -> Unit = {},
    onBack: () -> Unit = {},
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
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Урожай",
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
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.openAddSheet() },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Добавить урожай")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
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
        Icon(Icons.Default.ShoppingBasket, contentDescription = null,
            tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
        Text(
            "Урожай пока не записан",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            "Сначала добавьте посадку, затем фиксируйте сбор урожая",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onAddPlanting,
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(
                "Добавить посадку",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                softWrap = false
            )
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
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
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
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 22.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "всего вес",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (totalPcs > 0) "$totalPcs шт" else "—",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 22.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "всего штук",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "${harvests.size}",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 22.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "записей",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun HarvestByCropCard(harvests: List<Harvest>) {
    if (harvests.isEmpty()) return

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

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "По культурам",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
                TextButton(onClick = { expanded = !expanded }) {
                    Text(
                        if (expanded) "Свернуть" else "Развернуть",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold
                    )
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
                        Text(
                            cropName,
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            buildString {
                                if (kg > 0) append("%.1f кг".format(kg))
                                if (kg > 0 && pcs > 0) append(" · ")
                                if (pcs > 0) append("$pcs шт")
                            },
                            fontFamily = NunitoFamily,
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.ShoppingBasket, contentDescription = null,
                tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = harvest.cropName ?: "Посадка #${harvest.plantingId}",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onBackground
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
                        fontFamily = NunitoFamily,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Text(
                text = harvest.harvestedAt.take(10),
                fontFamily = NunitoFamily,
                fontSize = 12.sp,
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

    ModalBottomSheet(
        onDismissRequest = onDismiss,
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
                "Записать урожай",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
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
                    label = { Text("Культура", fontFamily = NunitoFamily) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(dropdownExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    shape = RoundedCornerShape(12.dp)
                )
                ExposedDropdownMenu(
                    expanded = dropdownExpanded,
                    onDismissRequest = { dropdownExpanded = false }
                ) {
                    plantings.forEach { planting ->
                        DropdownMenuItem(
                            text = { Text(planting.cropName ?: "Посадка #${planting.id}", fontFamily = NunitoFamily) },
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
                    label = { Text("Вес, кг", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Штук", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 4,
                minLines = 2,
                shape = RoundedCornerShape(12.dp)
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
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
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


