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
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.navigation.Screen
import ru.dachakalend.app.ui.actions.careTaskActionType
import javax.inject.Inject

data class PlantingsUiState(
    val plantings: List<Planting> = emptyList(),
    val stageFilter: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val showActionSheet: Planting? = null,
    val successMessage: String? = null,
    val pendingCropId: Int? = null,
    val pendingCropTransplantDays: Int? = null,
    val editingPlanting: Planting? = null,
    val showInfoSheet: Planting? = null,
    val confirmDeletePlanting: Planting? = null,
    val confirmFinishSeason: Planting? = null,
    val pendingTasks: Map<Int, TokenStorage.PendingTaskInfo> = emptyMap(),
    val snoozedTaskKeys: Set<String> = emptySet(),
    val datesNeedCheck: Boolean = false
) {
    val filteredPlantings: List<Planting>
        get() = when (stageFilter) {
            // «Все» — активные посадки без архива (завершённые сезоны скрыты)
            null   -> plantings.filter { it.stage != "done" }
            // Архив — только завершённые сезоны
            "done" -> plantings.filter { it.stage == "done" }
            else   -> plantings.filter { it.stage == stageFilter }
        }

    /** Есть ли завершённые посадки — для показа чипа-архива «Завершённые». */
    val hasArchived: Boolean
        get() = plantings.any { it.stage == "done" }
}

/**
 * Число посадок, требующих внимания — ровно то, что подсвечивается на карточке
 * (overdueCareTask с сервера ИЛИ non-care pending из кэша, не отложенные).
 * Единый источник для бейджа BottomNav, чтобы счётчик и карточки не расходились.
 * Используется и в TodayViewModel.
 */
fun attentionCount(
    plantings: List<Planting>,
    pending: Map<Int, TokenStorage.PendingTaskInfo>,
    snoozed: Set<String>
): Int = plantings.count { p ->
    val careUrgent = p.overdueCareTask?.let {
        "care_task_due:${p.id}:${p.cropName}:${it.name}" !in snoozed
    } ?: false
    val nonCareUrgent = pending[p.id]?.takeIf { it.type != "care_task_due" }?.let {
        "${it.type}:${p.id}:${p.cropName}:${it.careTaskName}" !in snoozed
    } ?: false
    careUrgent || nonCareUrgent
}

@HiltViewModel
class PlantingsViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val tokenStorage: TokenStorage,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingsUiState())
    val uiState: StateFlow<PlantingsUiState> = _uiState.asStateFlow()

    init {
        loadPlantings()
        val newCropId = savedStateHandle.get<Int>(Screen.Plantings.ARG_NEW_CROP_ID)
        if (newCropId != null && newCropId != -1) {
            _uiState.value = _uiState.value.copy(pendingCropId = newCropId)
            loadPendingCropDefault(newCropId)
        }
        // Реактивно отражаем флаг «проверить даты посадки» (ставится после онбординга).
        viewModelScope.launch {
            tokenStorage.plantingDatesNeedCheck.collect { need ->
                _uiState.value = _uiState.value.copy(datesNeedCheck = need)
            }
        }
    }

    /** Пользователь закрыл баннер «проверьте даты посадки». */
    fun dismissDatesNeedCheck() = tokenStorage.setPlantingDatesNeedCheck(false)

    /** Грузим transplant_days культуры → дефолт тоггла способа посадки (есть рассадный период → «через рассаду»). */
    private fun loadPendingCropDefault(cropId: Int) {
        viewModelScope.launch {
            val transplantDays = (cropsRepository.getCrop(cropId) as? Result.Success)?.data?.transplantDays
            _uiState.value = _uiState.value.copy(pendingCropTransplantDays = transplantDays)
        }
    }

    fun setStageFilter(stage: String?) {
        _uiState.value = _uiState.value.copy(stageFilter = stage)
    }

    fun loadPlantings(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            val pending = tokenStorage.getPendingTasks()
            val snoozed = tokenStorage.getSnoozedTasksForToday()
            when (val result = plantingsRepository.getPlantings(gardenId)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        plantings = result.data,
                        isLoading = false,
                        pendingTasks = pending,
                        snoozedTaskKeys = snoozed
                    )
                    // Бейдж = то, что реально подсвечено на карточках (карточки server-driven).
                    tokenStorage.saveAttentionCount(attentionCount(result.data, pending, snoozed))
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun confirmPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null) {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null)
        createPlanting(cropId, date, quantity, conditions, sowingMethod, variety)
    }

    fun dismissSetupSheet() {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null)
    }

    private fun createPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null) {
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
                conditions = conditions,
                sowingMethod = sowingMethod,
                variety = variety
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

    fun saveEditedInfo(plantingId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null) {
        _uiState.value = _uiState.value.copy(editingPlanting = null)
        viewModelScope.launch {
            // variety: null → не передаём (сервер не трогает); '' → сброс; текст → запись.
            val request = UpdatePlantingInfoRequest(plantedAt = date, quantity = quantity, conditions = conditions, sowingMethod = sowingMethod, variety = variety ?: "")
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

    fun openInfoSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(showInfoSheet = planting)
    }

    fun dismissInfoSheet() {
        _uiState.value = _uiState.value.copy(showInfoSheet = null)
    }

    fun requestDelete(planting: Planting) {
        _uiState.value = _uiState.value.copy(confirmDeletePlanting = planting)
    }

    fun dismissDelete() {
        _uiState.value = _uiState.value.copy(confirmDeletePlanting = null)
    }

    fun confirmDelete(plantingId: Int) {
        _uiState.value = _uiState.value.copy(confirmDeletePlanting = null)
        viewModelScope.launch {
            when (plantingsRepository.deletePlanting(plantingId)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка удалена")
                    loadPlantings()
                }
                is Result.Error   -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    fun requestFinishSeason(planting: Planting) {
        _uiState.value = _uiState.value.copy(confirmFinishSeason = planting)
    }

    fun dismissFinishSeason() {
        _uiState.value = _uiState.value.copy(confirmFinishSeason = null)
    }

    fun confirmFinishSeason(plantingId: Int) {
        _uiState.value = _uiState.value.copy(confirmFinishSeason = null)
        viewModelScope.launch {
            when (plantingsRepository.updateStage(plantingId, "done")) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Сезон завершён")
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

    /**
     * Действие реально записано → снимаем pending из кэша «Сегодня» ТОЛЬКО если
     * залогированный тип действительно закрывает задачу. Иначе (например, для care-задачи
     * «Прополка» записали «Полив») задача на сервере остаётся просроченной и после
     * перезагрузки вернулась бы — поэтому индикатор оставляем. Просрочка care-задач
     * берётся из сервера (overdue_care_task) и обновится при loadPlantings в closeActionSheet.
     */
    fun onActionLogged(plantingId: Int, loggedType: String) {
        val pending = _uiState.value.pendingTasks[plantingId] ?: return
        val satisfies = when (pending.type) {
            "watering_due"    -> loggedType == "watering"
            "fertilizing_due" -> loggedType == "fertilizing"
            "transplant_due"  -> loggedType == "transplanting"
            "care_task_due"   -> loggedType == careTaskActionType(pending.careTaskName)
            else              -> false
        }
        if (!satisfies) return
        val updatedPending = _uiState.value.pendingTasks - plantingId
        tokenStorage.savePendingTasks(updatedPending)
        _uiState.value = _uiState.value.copy(pendingTasks = updatedPending)
    }

    fun closeActionSheet() {
        // Закрытие без записи НЕ снимает pending (иначе индикатор и счётчик
        // рассинхронятся, а после /today задача вернётся). Чистим только в onActionLogged.
        _uiState.value = _uiState.value.copy(
            showActionSheet = null,
            snoozedTaskKeys = tokenStorage.getSnoozedTasksForToday()
        )
        loadPlantings(silent = true)
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null, error = null)
    }
}
