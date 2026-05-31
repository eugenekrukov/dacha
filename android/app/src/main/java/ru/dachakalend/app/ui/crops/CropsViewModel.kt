package ru.dachakalend.app.ui.crops

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class CropsUiState(
    val crops: List<Crop> = emptyList(),
    val filteredCrops: List<Crop> = emptyList(),
    val searchQuery: String = "",
    val selectedCategory: String? = null,
    val selectedCrop: Crop? = null,
    val climateZone: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

val CROP_CATEGORIES = listOf(
    null to "Все",
    "vegetable" to "Овощи",
    "herb" to "Зелень",
    "berry" to "Ягоды",
    "flower" to "Цветы"
)

@HiltViewModel
class CropsViewModel @Inject constructor(
    private val cropsRepository: CropsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CropsUiState())
    val uiState: StateFlow<CropsUiState> = _uiState.asStateFlow()

    init {
        _uiState.value = _uiState.value.copy(climateZone = cropsRepository.getClimateZone())
        loadCrops()
    }

    fun loadCrops(category: String? = _uiState.value.selectedCategory) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, selectedCategory = category)
            when (val result = cropsRepository.getCrops(category)) {
                is Result.Success -> {
                    val query = _uiState.value.searchQuery
                    _uiState.value = _uiState.value.copy(
                        crops = result.data,
                        filteredCrops = applySearch(result.data, query),
                        isLoading = false
                    )
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(
            searchQuery = query,
            filteredCrops = applySearch(_uiState.value.crops, query)
        )
    }

    private fun applySearch(crops: List<Crop>, query: String): List<Crop> {
        if (query.isBlank()) return crops
        val q = query.trim().lowercase()
        return crops.filter { it.name.lowercase().contains(q) }
    }

    fun selectCrop(crop: Crop) {
        _uiState.value = _uiState.value.copy(selectedCrop = crop)
    }

    fun loadCropById(cropId: Int) {
        if (_uiState.value.selectedCrop?.id == cropId) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = cropsRepository.getCrop(cropId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(selectedCrop = result.data, isLoading = false)
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun clearSelectedCrop() {
        _uiState.value = _uiState.value.copy(selectedCrop = null)
    }
}
