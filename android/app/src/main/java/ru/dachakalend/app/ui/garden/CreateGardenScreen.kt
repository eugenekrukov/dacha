package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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

private val GARDEN_TYPES = listOf(
    Triple("soil",       "Открытый грунт", "🌿"),
    Triple("greenhouse", "Теплица",        "🏠"),
    Triple("mixed",      "Смешанный",      "🌱")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGardenScreen(
    onGardenCreated: () -> Unit,
    viewModel: GardenViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    var gardenName      by remember { mutableStateOf("") }
    var cityName        by remember { mutableStateOf("") }
    var selectedRegion  by remember { mutableStateOf("") }
    var selectedType    by remember { mutableStateOf("soil") }
    var regionExpanded  by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        if (uiState is GardenUiState.Success) onGardenCreated()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🏡", fontSize = 56.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Расскажите об участке",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            "Нужно для точных рекомендаций",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = gardenName,
            onValueChange = { gardenName = it },
            label = { Text("Название участка") },
            placeholder = { Text("Например: Дача в Подмосковье") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = cityName,
            onValueChange = { cityName = it },
            label = { Text("Ваш город или посёлок") },
            placeholder = { Text("Например: Сергиев Посад") },
            supportingText = { Text("Для точного определения координат") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(Modifier.height(12.dp))

        ExposedDropdownMenuBox(
            expanded = regionExpanded,
            onExpandedChange = { regionExpanded = !regionExpanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = selectedRegion,
                onValueChange = {},
                readOnly = true,
                label = { Text("Регион") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = regionExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu(
                expanded = regionExpanded,
                onDismissRequest = { regionExpanded = false }
            ) {
                REGIONS.forEach { region ->
                    DropdownMenuItem(
                        text = { Text(region) },
                        onClick = { selectedRegion = region; regionExpanded = false }
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Тип участка
        Text(
            "Тип участка",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.align(Alignment.Start)
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            GARDEN_TYPES.forEach { (type, label, emoji) ->
                val selected = selectedType == type
                FilterChip(
                    selected = selected,
                    onClick = { selectedType = type },
                    label = { Text("$emoji $label") },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (uiState is GardenUiState.Error) {
            Spacer(Modifier.height(8.dp))
            Text(
                (uiState as GardenUiState.Error).message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = { viewModel.createGarden(gardenName, selectedRegion, cityName, selectedType) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = uiState !is GardenUiState.Loading
        ) {
            if (uiState is GardenUiState.Loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Создать участок", fontSize = 16.sp)
            }
        }
    }
}
