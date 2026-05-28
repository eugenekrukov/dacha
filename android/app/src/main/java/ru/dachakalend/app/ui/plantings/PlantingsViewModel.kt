package ru.dachakalend.app.ui.plantings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.CreatePlantingRequest
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import java.time.LocalDate
import javax.inject.Inject

data class PlantingsUiState(
    val plantings: List<Planting> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showActionSheet: Planting? = null,   // посадка, для которой открыт журнал действий
    val successMessage: String? = null
)

@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val gardenRepository: GardenRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingsUiState())
    val uiState: StateFlow<PlantingsUiState> = _uiState.asStateFlow()

    init {
        loadPlantings()
    }

    fun loadPlantings() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            // Берём первый сад пользователя
            val gardenId = gardenRepository.getGardens().getOrNull()?.firstOrNull()?.id
            plantingsRepository.getPlantings(gardenId).fold(
                onSuccess = { _uiState.value = _uiState.value.copy(plantings = it, isLoading = false) },
                onFailure = { _uiState.value = _uiState.value.copy(error = it.message, isLoading = false) }
            )
        }
    }

    fun createPlanting(cropId: Int, notes: String? = null) {
        viewModelScope.launch {
            val gardenId = gardenRepository.getGardens().getOrNull()?.firstOrNull()?.id ?: return@launch
            val request = CreatePlantingRequest(
                cropId = cropId,
                gardenId = gardenId,
                sownAt = LocalDate.now().toString(),
                notes = notes
            )
            plantingsRepository.createPlanting(request).fold(
                onSuccess = {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка добавлена!")
                    loadPlantings()
                },
                onFailure = { _uiState.value = _uiState.value.copy(error = it.message) }
            )
        }
    }

    fun openActionSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(showActionSheet = planting)
    }

    fun closeActionSheet() {
        _uiState.value = _uiState.value.copy(showActionSheet = null)
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null, error = null)
    }

    fun updateStage(plantingId: Int, stage: String) {
        viewModelScope.launch {
            plantingsRepository.updateStage(plantingId, stage).onSuccess { loadPlantings() }
        }
    }
}
