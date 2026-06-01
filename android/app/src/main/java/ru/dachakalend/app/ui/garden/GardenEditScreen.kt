package ru.dachakalend.app.ui.garden

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GardenEditScreen(
    onSaved: () -> Unit,
    onBack: () -> Unit,
    viewModel: GardenEditViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var gardenName      by remember { mutableStateOf("") }
    var cityName        by remember { mutableStateOf("") }
    var selectedRegion  by remember { mutableStateOf("") }
    var regionExpanded  by remember { mutableStateOf(false) }
    var formInitialized by remember { mutableStateOf(false) }
    var isGettingGps    by remember { mutableStateOf(false) }
    var gpsStatus       by remember { mutableStateOf<String?>(null) }

    // Предзаполнение формы — включая city
    LaunchedEffect(uiState) {
        if (!formInitialized) {
            val garden = when (val s = uiState) {
                is GardenEditUiState.Loaded         -> s.garden
                is GardenEditUiState.LocationFound  -> s.garden
                else -> null
            }
            if (garden != null) {
                gardenName     = garden.name
                selectedRegion = garden.region ?: ""
                cityName       = garden.city ?: ""
                formInitialized = true
            }
        }
        if (uiState is GardenEditUiState.LocationFound) {
            val s = uiState as GardenEditUiState.LocationFound
            gpsStatus = "✓ GPS: %.4f°N, %.4f°E".format(s.lat, s.lon)
            isGettingGps = false
        }
        if (uiState is GardenEditUiState.Saved) onSaved()
    }

    // Запрос разрешения GPS
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

    val isSaving = uiState is GardenEditUiState.Saving

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
            is GardenEditUiState.Loading -> Box(
                Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            else -> {
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
                        "Исправьте данные участка",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                    Spacer(Modifier.height(4.dp))

                    OutlinedTextField(
                        value = gardenName,
                        onValueChange = { gardenName = it },
                        label = { Text("Название участка") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isSaving
                    )

                    OutlinedTextField(
                        value = cityName,
                        onValueChange = { cityName = it },
                        label = { Text("Город или посёлок") },
                        placeholder = { Text("Например: Сергиев Посад") },
                        supportingText = { Text("Для точного прогноза погоды") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !isSaving
                    )

                    // GPS-кнопка
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
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

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
                                    onClick = { selectedRegion = region; regionExpanded = false }
                                )
                            }
                        }
                    }

                    if (errorMessage != null) {
                        Text(errorMessage, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(4.dp))

                    Button(
                        onClick = { viewModel.saveGarden(gardenName, selectedRegion, cityName.ifBlank { null }) },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        enabled = !isSaving
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                        } else {
                            Text("Сохранить", fontSize = 16.sp)
                        }
                    }
                }
            }
        }
    }
}
