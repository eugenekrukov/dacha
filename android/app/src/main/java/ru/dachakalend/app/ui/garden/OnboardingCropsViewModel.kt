package ru.dachakalend.app.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.CreatePlantingRequest
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import java.time.LocalDate
import javax.inject.Inject

data class OnboardingCropsUiState(
    val crops: List<Crop> = emptyList(),
    val selected: Set<Int> = emptySet(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val done: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class OnboardingCropsViewModel @Inject constructor(
    private val cropsRepository: CropsRepository,
    private val plantingsRepository: PlantingsRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingCropsUiState())
    val uiState: StateFlow<OnboardingCropsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            when (val result = cropsRepository.getCrops()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    crops = result.data,
                    isLoading = false
                )
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun toggleCrop(cropId: Int) {
        val current = _uiState.value.selected
        _uiState.value = _uiState.value.copy(
            selected = if (cropId in current) current - cropId else current + cropId
        )
    }

    fun addSelected() {
        val selected = _uiState.value.selected
        if (selected.isEmpty()) {
            _uiState.value = _uiState.value.copy(done = true)
            return
        }
        val gardenId = tokenStorage.getGardenId()
        if (gardenId == -1) {
            _uiState.value = _uiState.value.copy(done = true)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true)
            val today = LocalDate.now().toString()
            var allOk = true
            for (cropId in selected) {
                val result = plantingsRepository.createPlanting(
                    CreatePlantingRequest(
                        cropId = cropId,
                        gardenId = gardenId,
                        sownAt = today
                    )
                )
                if (result is Result.Error) allOk = false
            }
            // Даты выставлены = сегодня без явного выбора — попросим пользователя проверить их
            // на экране «Посадки» (баннер-подсказка).
            tokenStorage.setPlantingDatesNeedCheck(true)
            _uiState.value = _uiState.value.copy(isSaving = false, done = true)
        }
    }
}
