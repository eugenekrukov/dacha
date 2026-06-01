package ru.dachakalend.app.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.GeocodeSuggestion
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.GeocoderRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

sealed class GardenUiState {
    object Idle : GardenUiState()
    object Loading : GardenUiState()
    data class Success(val saveMessage: String? = null) : GardenUiState()
    object GettingLocation : GardenUiState()
    data class LocationFound(val lat: Double, val lon: Double) : GardenUiState()
    data class Error(val message: String) : GardenUiState()
}

@HiltViewModel
class GardenViewModel @Inject constructor(
    private val gardenRepository: GardenRepository,
    private val geocoderRepository: GeocoderRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GardenUiState>(GardenUiState.Idle)
    val uiState: StateFlow<GardenUiState> = _uiState

    private val _suggestions = MutableStateFlow<List<GeocodeSuggestion>>(emptyList())
    val suggestions: StateFlow<List<GeocodeSuggestion>> = _suggestions.asStateFlow()

    private var pendingLat: Double? = null
    private var pendingLon: Double? = null
    private var coordinateSource: String = "region" // "gps" | "city" | "region"

    fun searchCity(query: String) {
        if (query.length < 2) { _suggestions.value = emptyList(); return }
        viewModelScope.launch {
            when (val r = geocoderRepository.suggest(query)) {
                is Result.Success -> _suggestions.value = r.data
                else -> _suggestions.value = emptyList()
            }
        }
    }

    fun clearSuggestions() { _suggestions.value = emptyList() }

    fun onSuggestionSelected(s: GeocodeSuggestion) {
        pendingLat = s.lat
        pendingLon = s.lon
        coordinateSource = "city"
        _suggestions.value = emptyList()
    }

    fun onLocationObtained(lat: Double, lon: Double) {
        pendingLat = lat
        pendingLon = lon
        coordinateSource = "gps"
        _uiState.value = GardenUiState.LocationFound(lat, lon)
    }

    fun onLocationFailed() {
        _uiState.value = GardenUiState.Error("Не удалось определить координаты. Введите город вручную.")
    }

    fun createGarden(name: String, region: String, city: String? = null, gardenType: String = "soil") {
        if (name.isBlank()) { _uiState.value = GardenUiState.Error("Введите название участка"); return }
        viewModelScope.launch {
            _uiState.value = GardenUiState.Loading
            when (val result = gardenRepository.createGarden(name, region, city, gardenType, pendingLat, pendingLon)) {
                is Result.Success -> {
                    val msg = saveMessage(city)
                    _uiState.value = GardenUiState.Success(msg)
                }
                is Result.Error   -> _uiState.value = GardenUiState.Error(result.message)
                is Result.Loading -> _uiState.value = GardenUiState.Loading
            }
        }
    }

    private fun saveMessage(city: String?) = when {
        coordinateSource == "gps"  -> "✓ GPS-координаты сохранены — прогноз будет точным"
        coordinateSource == "city" -> "✓ Координаты определены по городу"
        !city.isNullOrBlank()      -> "⚠️ Город не найден — используется центр региона"
        else                       -> null
    }
}
