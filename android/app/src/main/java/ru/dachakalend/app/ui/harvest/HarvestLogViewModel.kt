package ru.dachakalend.app.ui.harvest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.repository.HarvestRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

@HiltViewModel
class HarvestLogViewModel @Inject constructor(
    private val harvestRepository: HarvestRepository,
    private val plantingsRepository: PlantingsRepository,
) : ViewModel() {

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    fun logHarvest(
        plantingId: Int,
        weightKg: Double?,
        quantity: Int?,
        notes: String?,
        finishSeason: Boolean,
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            _isSaving.value = true
            when (harvestRepository.addHarvest(plantingId, weightKg, quantity, notes)) {
                is Result.Success -> {
                    if (finishSeason) plantingsRepository.updateStage(plantingId, "done")
                    _isSaving.value = false
                    onDone()
                }
                else -> _isSaving.value = false
            }
        }
    }
}
