package ru.dachakalend.app.ui.harvest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Harvest
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.repository.HarvestRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class HarvestUiState(
    val harvests: List<Harvest> = emptyList(),
    val plantings: List<Planting> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
    val showAddSheet: Boolean = false
)

@HiltViewModel
class HarvestViewModel @Inject constructor(
    private val harvestRepository: HarvestRepository,
    private val plantingsRepository: PlantingsRepository,
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow(HarvestUiState())
    val uiState: StateFlow<HarvestUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }

            val harvestResult = harvestRepository.getHarvests(gardenId)
            val plantingsResult = plantingsRepository.getPlantings(gardenId)

            val harvests = (harvestResult as? Result.Success)?.data ?: emptyList()
            val plantings = (plantingsResult as? Result.Success)?.data ?: emptyList()
            val error = (harvestResult as? Result.Error)?.message
                ?: (plantingsResult as? Result.Error)?.message

            _uiState.value = _uiState.value.copy(
                harvests = harvests,
                plantings = plantings,
                isLoading = false,
                error = error
            )
        }
    }

    fun addHarvest(plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?, finishSeason: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true)
            when (val result = harvestRepository.addHarvest(plantingId, weightKg, quantity, notes)) {
                is Result.Success -> {
                    if (finishSeason) plantingsRepository.updateStage(plantingId, "done")
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        showAddSheet = false,
                        successMessage = "Урожай записан!"
                    )
                    load()
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    error = result.message
                )
                is Result.Loading -> Unit
            }
        }
    }

    fun openAddSheet() {
        _uiState.value = _uiState.value.copy(showAddSheet = true)
    }

    fun closeAddSheet() {
        _uiState.value = _uiState.value.copy(showAddSheet = false)
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null, error = null)
    }
}
