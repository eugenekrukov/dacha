package ru.dachakalend.app.ui.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Garden
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

sealed class GardenEditUiState {
    object Loading : GardenEditUiState()
    data class Loaded(val garden: Garden) : GardenEditUiState()
    object Saving : GardenEditUiState()
    object Saved : GardenEditUiState()
    data class Error(val message: String) : GardenEditUiState()
}

@HiltViewModel
class GardenEditViewModel @Inject constructor(
    private val gardenRepository: GardenRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GardenEditUiState>(GardenEditUiState.Loading)
    val uiState: StateFlow<GardenEditUiState> = _uiState

    init {
        loadCurrentGarden()
    }

    private fun loadCurrentGarden() {
        viewModelScope.launch {
            _uiState.value = GardenEditUiState.Loading
            when (val result = gardenRepository.loadGardens()) {
                is Result.Success -> {
                    val garden = result.data.firstOrNull()
                    if (garden != null) {
                        _uiState.value = GardenEditUiState.Loaded(garden)
                    } else {
                        _uiState.value = GardenEditUiState.Error("Участок не найден")
                    }
                }
                is Result.Error   -> _uiState.value = GardenEditUiState.Error(result.message)
                is Result.Loading -> _uiState.value = GardenEditUiState.Loading
            }
        }
    }

    fun saveGarden(name: String, region: String, city: String?) {
        if (name.isBlank()) {
            _uiState.value = GardenEditUiState.Error("Введите название участка")
            return
        }
        val gardenId = gardenRepository.getCurrentGardenId()
        if (gardenId == -1) {
            _uiState.value = GardenEditUiState.Error("Участок не найден")
            return
        }
        viewModelScope.launch {
            _uiState.value = GardenEditUiState.Saving
            _uiState.value = when (val result = gardenRepository.updateGarden(gardenId, name, region, city)) {
                is Result.Success -> GardenEditUiState.Saved
                is Result.Error   -> GardenEditUiState.Error(result.message)
                is Result.Loading -> GardenEditUiState.Saving
            }
        }
    }
}
