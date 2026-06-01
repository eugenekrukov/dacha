package ru.dachakalend.app.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

sealed class GardenUiState {
    object Idle : GardenUiState()
    object Loading : GardenUiState()
    object Success : GardenUiState()
    object GettingLocation : GardenUiState()
    data class LocationFound(val lat: Double, val lon: Double) : GardenUiState()
    data class Error(val message: String) : GardenUiState()
}

@HiltViewModel
class GardenViewModel @Inject constructor(
    private val gardenRepository: GardenRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GardenUiState>(GardenUiState.Idle)
    val uiState: StateFlow<GardenUiState> = _uiState

    private var pendingLat: Double? = null
    private var pendingLon: Double? = null

    fun onLocationObtained(lat: Double, lon: Double) {
        pendingLat = lat
        pendingLon = lon
        _uiState.value = GardenUiState.LocationFound(lat, lon)
    }

    fun onLocationFailed() {
        _uiState.value = GardenUiState.Error("Не удалось определить координаты. Введите город вручную.")
    }

    fun createGarden(
        name: String,
        region: String,
        city: String? = null,
        gardenType: String = "soil"
    ) {
        if (name.isBlank()) {
            _uiState.value = GardenUiState.Error("Введите название участка")
            return
        }
        viewModelScope.launch {
            _uiState.value = GardenUiState.Loading
            _uiState.value = when (val result = gardenRepository.createGarden(
                name, region, city, gardenType, pendingLat, pendingLon
            )) {
                is Result.Success -> GardenUiState.Success
                is Result.Error   -> GardenUiState.Error(result.message)
                is Result.Loading -> GardenUiState.Loading
            }
        }
    }
}
