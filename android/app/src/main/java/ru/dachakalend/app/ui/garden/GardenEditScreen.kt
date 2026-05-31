package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

private val REGIONS = listOf(
    "Москва и МО", "Санкт-Петербург и ЛО", "Краснодарский край",
    "Ростовская область", "Татарстан", "Свердловская область",
    "Новосибирская область", "Самарская область", "Другой регион"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GardenEditScreen(
    onSaved: () -> Unit,
    onBack: () -> Unit,
    viewModel: GardenEditViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // Поля формы — заполняются один раз при загрузке
    var gardenName by remember { mutableStateOf("") }
    var cityName by remember { mutableStateOf("") }
    var selectedRegion by remember { mutableStateOf("") }
    var regionExpanded by remember { mutableStateOf(false) }
    var formInitialized by remember { mutableStateOf(false) }

    // Заполнить форму данными участка
    LaunchedEffect(uiState) {
        if (uiState is GardenEditUiState.Loaded && !formInitialized) {
            val garden = (uiState as GardenEditUiState.Loaded).garden
            gardenName = garden.name
            selectedRegion = garden.region ?: ""
            formInitialized = true
        }
        if (uiState is GardenEditUiState.Saved) {
            onSaved()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Редактировать участок") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is GardenEditUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            else -> {
                val isSaving = uiState is GardenEditUiState.Saving
                val errorMessage = (uiState as? GardenEditUiState.Error)?.message

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Исправьте данные участка",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )

                    Spacer(Modifier.height(8.dp))

                    OutlinedTextField(
                        value = gardenName,
                        onValueChange = { gardenName = it },
                        label = { Text("Название участка") },
                        placeholder = { Text("Например: Дача в Подмосковье") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isSaving
                    )

                    OutlinedTextField(
                        value = cityName,
                        onValueChange = { cityName = it },
                        label = { Text("Город или посёлок") },
                        placeholder = { Text("Например: Сергиев Посад") },
                        supportingText = { Text("Для уточнения координат и климатической зоны") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isSaving
                    )

                    ExposedDropdownMenuBox(
                        expanded = regionExpanded,
                        onExpandedChange = { if (!isSaving) regionExpanded = !regionExpanded },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = selectedRegion,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Регион") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = regionExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            enabled = !isSaving
                        )
                        ExposedDropdownMenu(
                            expanded = regionExpanded,
                            onDismissRequest = { regionExpanded = false }
                        ) {
                            REGIONS.forEach { region ->
                                DropdownMenuItem(
                                    text = { Text(region) },
                                    onClick = {
                                        selectedRegion = region
                                        regionExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    if (errorMessage != null) {
                        Text(
                            text = errorMessage,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Spacer(Modifier.height(8.dp))

                    Button(
                        onClick = {
                            viewModel.saveGarden(gardenName, selectedRegion, cityName.ifBlank { null })
                        },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        enabled = !isSaving
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Сохранить", fontSize = 16.sp)
                        }
                    }
                }
            }
        }
    }
}
