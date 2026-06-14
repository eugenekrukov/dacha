package ru.dachakalend.app.ui.plantings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.GuideRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class PlantingInfoUiState(
    val planting: Planting? = null,
    val crop: Crop? = null,
    val recentActions: List<ActionLog> = emptyList(),
    val problems: List<GuideEntry> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class PlantingInfoViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val actionsRepository: ActionsRepository,
    private val guideRepository: GuideRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingInfoUiState())
    val uiState: StateFlow<PlantingInfoUiState> = _uiState.asStateFlow()

    private var loadedPlantingId: Int = -1

    fun load(plantingId: Int) {
        if (loadedPlantingId == plantingId && _uiState.value.planting != null) return
        loadedPlantingId = plantingId
        viewModelScope.launch {
            _uiState.value = PlantingInfoUiState(isLoading = true)
            val pRes = plantingsRepository.getPlanting(plantingId)
            val planting = (pRes as? Result.Success)?.data
            if (planting == null) {
                _uiState.value = PlantingInfoUiState(error = (pRes as? Result.Error)?.message ?: "Не найдено")
                return@launch
            }
            val cropDeferred = async { cropsRepository.getCrop(planting.cropId) }
            val actionsDeferred = async { actionsRepository.getActions(plantingId) }
            val guideDeferred = async { guideRepository.getGuide(cropId = planting.cropId) }

            val crop = cropDeferred.await()
            val actions = actionsDeferred.await()
            val guide = guideDeferred.await()

            _uiState.value = PlantingInfoUiState(
                planting = planting,
                crop = if (crop is Result.Success) crop.data else null,
                recentActions = if (actions is Result.Success) actions.data else emptyList(),
                problems = if (guide is Result.Success) guide.data else emptyList(),
                isLoading = false,
                error = if (crop is Result.Error) crop.message else null
            )
        }
    }

    fun reset() {
        loadedPlantingId = -1
        _uiState.value = PlantingInfoUiState()
    }
}
