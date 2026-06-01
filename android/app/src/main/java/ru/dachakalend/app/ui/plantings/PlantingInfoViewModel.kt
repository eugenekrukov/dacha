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
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class PlantingInfoUiState(
    val crop: Crop? = null,
    val recentActions: List<ActionLog> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class PlantingInfoViewModel @Inject constructor(
    private val cropsRepository: CropsRepository,
    private val actionsRepository: ActionsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingInfoUiState())
    val uiState: StateFlow<PlantingInfoUiState> = _uiState.asStateFlow()

    private var loadedPlantingId: Int = -1

    fun load(plantingId: Int, cropId: Int) {
        if (loadedPlantingId == plantingId && _uiState.value.crop != null) return
        loadedPlantingId = plantingId
        viewModelScope.launch {
            _uiState.value = PlantingInfoUiState(isLoading = true)
            val cropDeferred    = async { cropsRepository.getCrop(cropId) }
            val actionsDeferred = async { actionsRepository.getActions(plantingId) }

            val crop    = cropDeferred.await()
            val actions = actionsDeferred.await()

            _uiState.value = PlantingInfoUiState(
                crop = if (crop is Result.Success) crop.data else null,
                recentActions = if (actions is Result.Success) actions.data.take(20) else emptyList(),
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
