package ru.dachakalend.app.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Garden
import ru.dachakalend.app.data.model.GeocodeSuggestion
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.GeocoderRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

sealed class GardenEditUiState {
    object Loading : GardenEditUiState()
    data class Loaded(val garden: Garden) : GardenEditUiState()
    object Saving : GardenEditUiState()
    data class Saved(val message: String? = null) : GardenEditUiState()
    object GettingLocation : GardenEditUiState()
    data class LocationFound(val lat: Double, val lon: Double, val garden: Garden) : GardenEditUiState()
    data class Error(val message: String) : GardenEditUiState()
}

@OptIn(FlowPreview::class)
@HiltViewModel
class GardenEditViewModel @Inject constructor(
    private val gardenRepository: GardenRepository,
    private val geocoderRepository: GeocoderRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GardenEditUiState>(GardenEditUiState.Loading)
    val uiState: StateFlow<GardenEditUiState> = _uiState

    private val _suggestions = MutableStateFlow<List<GeocodeSuggestion>>(emptyList())
    val suggestions: StateFlow<List<GeocodeSuggestion>> = _suggestions.asStateFlow()

    private val _detectedZone = MutableStateFlow<String?>(null)
    val detectedZone: StateFlow<String?> = _detectedZone.asStateFlow()

    private val _queryFlow = MutableStateFlow("")

    private var pendingLat: Double? = null
    private var pendingLon: Double? = null
    private var pendingZone: String? = null
    private var coordinateSource: String = "region"

    init {
        loadCurrentGarden()
        // Дебаунс поиска — в ViewModel через Flow, независимо от Compose lifecycle
        viewModelScope.launch {
            _queryFlow
                .debounce(400L)
                .filter { it.length >= 2 }
                .distinctUntilChanged()
                .collect { query ->
                    when (val r = geocoderRepository.suggest(query)) {
                        is Result.Success -> _suggestions.value = r.data
                        else -> { /* не сбрасываем */ }
                    }
                }
        }
    }

    private fun loadCurrentGarden() {
        viewModelScope.launch {
            _uiState.value = GardenEditUiState.Loading
            when (val result = gardenRepository.loadGardens()) {
                is Result.Success -> {
                    val garden = result.data.firstOrNull()
                    if (garden != null) {
                        // Сохраняем существующие координаты — они используются если пользователь
                        // не меняет город и не нажимает GPS
                        pendingLat = garden.lat
                        pendingLon = garden.lon
                        coordinateSource = if (garden.lat != null) "city" else "region"
                        _uiState.value = GardenEditUiState.Loaded(garden)
                    } else _uiState.value = GardenEditUiState.Error("Участок не найден")
                }
                is Result.Error   -> _uiState.value = GardenEditUiState.Error(result.message)
                is Result.Loading -> {}
            }
        }
    }

    fun onCityQueryChanged(query: String) {
        _queryFlow.value = query
        if (query.length < 2) _suggestions.value = emptyList()
    }

    fun onSuggestionSelected(s: GeocodeSuggestion) {
        pendingLat = s.lat
        pendingLon = s.lon
        pendingZone = s.zone
        coordinateSource = "city"
        _detectedZone.value = s.zone
        _suggestions.value = emptyList()
    }

    fun onLocationObtained(lat: Double, lon: Double) {
        pendingLat = lat
        pendingLon = lon
        coordinateSource = "gps"
        val garden = currentGarden() ?: return
        _uiState.value = GardenEditUiState.LocationFound(lat, lon, garden)
    }

    fun onLocationFailed() {
        val garden = currentGarden() ?: return
        _uiState.value = GardenEditUiState.Loaded(garden)
    }

    fun saveGarden(name: String, region: String?, city: String?, gardenType: String? = null) {
        if (name.isBlank()) { _uiState.value = GardenEditUiState.Error("Введите название участка"); return }
        if (city.isNullOrBlank() && pendingLat == null) {
            _uiState.value = GardenEditUiState.Error("Укажите населённый пункт или нажмите «Определить по GPS»")
            return
        }
        val gardenId = gardenRepository.getCurrentGardenId()
        if (gardenId == -1) { _uiState.value = GardenEditUiState.Error("Участок не найден"); return }
        viewModelScope.launch {
            _uiState.value = GardenEditUiState.Saving
            when (val result = gardenRepository.updateGarden(gardenId, name, region, city, gardenType, pendingLat, pendingLon, pendingZone)) {
                is Result.Success -> _uiState.value = GardenEditUiState.Saved(saveMessage(city))
                is Result.Error   -> _uiState.value = GardenEditUiState.Error(result.message)
                is Result.Loading -> _uiState.value = GardenEditUiState.Saving
            }
        }
    }

    private fun currentGarden(): Garden? =
        (_uiState.value as? GardenEditUiState.Loaded)?.garden
            ?: (_uiState.value as? GardenEditUiState.LocationFound)?.garden

    private fun saveMessage(city: String?) = when {
        coordinateSource == "gps"  -> "✓ GPS-координаты сохранены — прогноз будет точным"
        coordinateSource == "city" -> "✓ Координаты определены по городу"
        !city.isNullOrBlank()      -> "✓ Участок сохранён"
        else                       -> null
    }
}
