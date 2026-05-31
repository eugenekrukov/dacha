package ru.dachakalend.app.ui.plantings

import androidx.lifecycle.SavedStateHandle
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
import ru.dachakalend.app.data.model.UpdatePlantingInfoRequest
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.navigation.Screen
import java.time.LocalDate
import javax.inject.Inject

data class PlantingsUiState(
    val plantings: List<Planting> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showActionSheet: Planting? = null,
    val successMessage: String? = null,
    // Шторка создания посадки (при нажатии "Посадить")
    val pendingCropId: Int? = null,
    // Шторка редактирования посадки (в 3 точках)
    val editingPlanting: Planting? = null
)

@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val tokenStorage: TokenStorage,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingsUiState())
    val uiState: StateFlow<PlantingsUiState> = _uiState.asStateFlow()

    init {
        loadPlantings()
        // Если пришли из CropDetail — открываем шторку настройки посадки
        val newCropId = savedStateHandle.get<Int>(Screen.Plantings.ARG_NEW_CROP_ID)
        if (newCropId != null && newCropId != -1) {
            _uiState.value = _uiState.value.copy(pendingCropId = newCropId)
        }
    }

    fun loadPlantings() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            when (val result = plantingsRepository.getPlantings(gardenId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(plantings = result.data, isLoading = false)
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    /** Подтверждение из PlantingSetupBottomSheet */
    fun confirmPlanting(cropId: Int, date: String, quantity: Int, conditions: String) {
        _uiState.value = _uiState.value.copy(pendingCropId = null)
        createPlanting(cropId, date, quantity, conditions)
    }

    fun dismissSetupSheet() {
        _uiState.value = _uiState.value.copy(pendingCropId = null)
    }

    private fun createPlanting(cropId: Int, date: String, quantity: Int, conditions: String) {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId()
            if (gardenId == -1) {
                _uiState.value = _uiState.value.copy(error = "Участок не найден")
                return@launch
            }
            val request = CreatePlantingRequest(
                cropId = cropId,
                gardenId = gardenId,
                sownAt = date,
                quantity = quantity,
                conditions = conditions
            )
            when (val result = plantingsRepository.createPlanting(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка добавлена!")
                    loadPlantings()
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun openEditSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(editingPlanting = planting)
    }

    fun dismissEditSheet() {
        _uiState.value = _uiState.value.copy(editingPlanting = null)
    }

    fun saveEditedInfo(plantingId: Int, date: String, quantity: Int, conditions: String) {
        _uiState.value = _uiState.value.copy(editingPlanting = null)
        viewModelScope.launch {
            val request = UpdatePlantingInfoRequest(
                plantedAt = date,
                quantity = quantity,
                conditions = conditions
            )
            when (plantingsRepository.updateInfo(plantingId, request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка обновлена!")
                    loadPlantings()
                }
                is Result.Error   -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    fun updateStage(plantingId: Int, stage: String) {
        viewModelScope.launch {
            when (plantingsRepository.updateStage(plantingId, stage)) {
                is Result.Success -> loadPlantings()
                is Result.Error   -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    fun openActionSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(showActionSheet = planting)
    }

    fun closeActionSheet() {
        _uiState.value = _uiState.value.copy(showActionSheet = null)
        loadPlantings()
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null, error = null)
    }
}
