package ru.dachakalend.app.ui.garden

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.local.LocationHelper

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
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var gardenName     by remember { mutableStateOf("") }
    var cityName       by remember { mutableStateOf("") }
    var selectedRegion by remember { mutableStateOf("") }
    var selectedType   by remember { mutableStateOf("soil") }
    var regionExpanded by remember { mutableStateOf(false) }
    var isGettingGps   by remember { mutableStateOf(false) }
    var gpsStatus      by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(uiState) {
        if (uiState is GardenUiState.Success) onGardenCreated()
        if (uiState is GardenUiState.LocationFound) {
            val s = uiState as GardenUiState.LocationFound
            gpsStatus = "✓ GPS: %.4f°N, %.4f°E".format(s.lat, s.lon)
            isGettingGps = false
        }
    }

    val locationPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.any { it }) {
            scope.launch {
                val loc = LocationHelper.getLocation(context)
                if (loc != null) viewModel.onLocationObtained(loc.first, loc.second)
                else { viewModel.onLocationFailed(); isGettingGps = false; gpsStatus = "Координаты не определены" }
            }
        } else {
            isGettingGps = false
            gpsStatus = "Разрешение отклонено — введите город вручную"
        }
    }

    fun requestGps() {
        isGettingGps = true
        gpsStatus = null
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fine == PackageManager.PERMISSION_GRANTED) {
            scope.launch {
                val loc = LocationHelper.getLocation(context)
                if (loc != null) viewModel.onLocationObtained(loc.first, loc.second)
                else { viewModel.onLocationFailed(); isGettingGps = false; gpsStatus = "Координаты не определены" }
            }
        } else {
            locationPermLauncher.launch(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ))
        }
    }

    val isSaving = uiState is GardenUiState.Loading

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
        Text("Расскажите об участке", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
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
            supportingText = { Text("Для точного прогноза погоды") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(Modifier.height(8.dp))

        // GPS кнопка
        OutlinedButton(
            onClick = { requestGps() },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isSaving && !isGettingGps
        ) {
            if (isGettingGps) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text("Определяем координаты...")
            } else {
                Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Определить по GPS")
            }
        }

        gpsStatus?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = if (it.startsWith("✓")) Color(0xFF2E7D32)
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

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

        Text("Тип участка", style = MaterialTheme.typography.labelLarge, modifier = Modifier.align(Alignment.Start))
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GARDEN_TYPES.forEach { (type, label, emoji) ->
                FilterChip(
                    selected = selectedType == type,
                    onClick = { selectedType = type },
                    label = { Text("$emoji $label", style = MaterialTheme.typography.bodySmall) },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (uiState is GardenUiState.Error) {
            Spacer(Modifier.height(8.dp))
            Text((uiState as GardenUiState.Error).message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = { viewModel.createGarden(gardenName, selectedRegion, cityName.ifBlank { null }, selectedType) },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !isSaving
        ) {
            if (isSaving) {
                CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            } else {
                Text("Создать участок", fontSize = 16.sp)
            }
        }
    }
}
