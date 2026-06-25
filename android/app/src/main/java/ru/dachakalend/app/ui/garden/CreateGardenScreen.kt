package ru.dachakalend.app.ui.garden

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.House
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.local.LocationHelper
import ru.dachakalend.app.ui.theme.NunitoFamily


private val GARDEN_TYPES: List<Triple<String, String, ImageVector>> = listOf(
    Triple("soil",       "Открытый грунт", Icons.Default.Grass),
    Triple("greenhouse", "Теплица",        Icons.Default.House),
    Triple("mixed",      "Смешанный",      Icons.Default.Spa)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGardenScreen(
    onGardenCreated: () -> Unit,
    viewModel: GardenViewModel = hiltViewModel()
) {
    val uiState      by viewModel.uiState.collectAsState()
    val suggestions  by viewModel.suggestions.collectAsState()
    val detectedZone by viewModel.detectedZone.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var gardenName     by remember { mutableStateOf("") }
    var cityName       by remember { mutableStateOf("") }
    var selectedRegion by remember { mutableStateOf("") }
    var selectedType   by remember { mutableStateOf("soil") }
    var isGettingGps   by remember { mutableStateOf(false) }
    var gpsStatus      by remember { mutableStateOf<String?>(null) }
    var cityError      by remember { mutableStateOf(false) }
    var nameError      by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        when (val s = uiState) {
            is GardenUiState.Success -> {
                s.saveMessage?.let { snackbarHostState.showSnackbar(it) }
                onGardenCreated()
            }
            is GardenUiState.LocationFound -> {
                gpsStatus = "✓ GPS: %.4f°N, %.4f°E".format(s.lat, s.lon)
                isGettingGps = false; cityError = false
            }
            is GardenUiState.Error -> isGettingGps = false
            else -> {}
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
        } else { isGettingGps = false; gpsStatus = "Разрешение отклонено — введите город вручную" }
    }

    fun requestGps() {
        isGettingGps = true; gpsStatus = null; cityError = false
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fine == PackageManager.PERMISSION_GRANTED) {
            scope.launch {
                val loc = LocationHelper.getLocation(context)
                if (loc != null) viewModel.onLocationObtained(loc.first, loc.second)
                else { viewModel.onLocationFailed(); isGettingGps = false; gpsStatus = "Координаты не определены" }
            }
        } else {
            locationPermLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    val isSaving = uiState is GardenUiState.Loading

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Default.House, contentDescription = null,
                tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(56.dp))
            Spacer(Modifier.height(8.dp))
            Text(
                "Расскажите об участке",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 24.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                "Нужно для точных рекомендаций",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = gardenName,
                onValueChange = { gardenName = it; nameError = false },
                label = { Text("Название участка *", fontFamily = NunitoFamily) },
                placeholder = { Text("Например: Дача в Подмосковье", fontFamily = NunitoFamily) },
                isError = nameError,
                supportingText = if (nameError) {
                    { Text("Обязательное поле", color = MaterialTheme.colorScheme.error, fontFamily = NunitoFamily) }
                } else null,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(Modifier.height(12.dp))

            CityInputField(
                value = cityName,
                onValueChange = { cityName = it; cityError = false },
                suggestions = suggestions,
                detectedZone = detectedZone,
                onCityQueryChanged = { viewModel.onCityQueryChanged(it) },
                onSuggestionSelected = { viewModel.onSuggestionSelected(it) },
                enabled = !isSaving,
                isError = cityError
            )
            Spacer(Modifier.height(8.dp))

            OutlinedButton(
                onClick = { requestGps() },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(16.dp),
                enabled = !isSaving && !isGettingGps
            ) {
                if (isGettingGps) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Определяем координаты...",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    Icon(Icons.Default.LocationOn, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Определить по GPS",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            gpsStatus?.let {
                Text(
                    it,
                    fontFamily = NunitoFamily,
                    fontSize = 12.sp,
                    color = if (it.startsWith("✓")) Color(0xFF2E7D32) else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            Spacer(Modifier.height(12.dp))

            RegionInputField(
                value = selectedRegion,
                onValueChange = { selectedRegion = it },
                enabled = !isSaving
            )
            Spacer(Modifier.height(16.dp))

            Text(
                "ТИП УЧАСТКА",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GARDEN_TYPES.forEach { (type, label, icon) ->
                    FilterChip(
                        selected = selectedType == type,
                        onClick = { selectedType = type },
                        shape = RoundedCornerShape(100.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                            selectedLabelColor = Color.White
                        ),
                        leadingIcon = {
                            Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp))
                        },
                        label = {
                            Text(
                                label,
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                softWrap = false
                            )
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (uiState is GardenUiState.Error) {
                Spacer(Modifier.height(8.dp))
                Text(
                    (uiState as GardenUiState.Error).message,
                    fontFamily = NunitoFamily,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp
                )
            }
            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    val nameBlank = gardenName.isBlank()
                    val cityBlank = cityName.isBlank() && uiState !is GardenUiState.LocationFound
                    nameError = nameBlank
                    cityError = cityBlank
                    if (!nameBlank && !cityBlank) {
                        viewModel.createGarden(gardenName, selectedRegion.ifBlank { null }, cityName.ifBlank { null }, selectedType)
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                enabled = !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        "Создать участок",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        softWrap = false
                    )
                }
            }
        }
    }
}


