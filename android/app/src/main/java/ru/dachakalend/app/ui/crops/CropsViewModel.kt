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
import javax.inject.Inject

data class CropsUiState(
    val crops: List<Crop> = emptyList(),
    val selectedCategory: String? = null,
    val selectedCrop: Crop? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

val CROP_CATEGORIES = listOf(
    null to "Все",
    "vegetables" to "Овощи",
    "greens" to "Зелень",
    "fruits" to "Фрукты",
    "berries" to "Ягоды",
    "flowers" to "Цветы"
)

@HiltViewModel
class CropsViewModel @Inject constructor(
    private val cropsRepository: CropsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CropsUiState())
    val uiState: StateFlow<CropsUiState> = _uiState.asStateFlow()

    init {
        loadCrops()
    }

    fun loadCrops(category: String? = _uiState.value.selectedCategory) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, selectedCategory = category)
            cropsRepository.getCrops(category).fold(
                onSuccess = { _uiState.value = _uiState.value.copy(crops = it, isLoading = false) },
                onFailure = { _uiState.value = _uiState.value.copy(error = it.message, isLoading = false) }
            )
        }
    }

    fun selectCrop(crop: Crop) {
        _uiState.value = _uiState.value.copy(selectedCrop = crop)
    }

    fun clearSelectedCrop() {
        _uiState.value = _uiState.value.copy(selectedCrop = null)
    }
}
