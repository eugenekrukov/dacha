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
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.UpdatePlantingInfoRequest
import ru.dachakalend.app.data.repository.BedsRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.navigation.Screen
import ru.dachakalend.app.notification.ReminderScheduler
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
    val pendingCropFamily: String? = null,
    val editingCropFamily: String? = null,
    val beds: List<GardenBed> = emptyList(),
    val editingPlanting: Planting? = null,
    val showInfoSheet: Planting? = null,
    val confirmDeletePlanting: Planting? = null,
    val confirmFinishSeason: Planting? = null,
    val reminderPlanting: Planting? = null,
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
    private val bedsRepository: BedsRepository,
    private val tokenStorage: TokenStorage,
    private val reminderScheduler: ReminderScheduler,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlantingsUiState())
    val uiState: StateFlow<PlantingsUiState> = _uiState.asStateFlow()

    init {
        loadPlantings()
        loadBeds()
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

    /** Грузим культуру для дефолта способа посадки (рассада) и семейства (подсказка севооборота). */
    private fun loadPendingCropDefault(cropId: Int) {
        viewModelScope.launch {
            val crop = (cropsRepository.getCrop(cropId) as? Result.Success)?.data
            _uiState.value = _uiState.value.copy(
                pendingCropTransplantDays = crop?.transplantDays,
                pendingCropFamily = crop?.family
            )
        }
    }

    private fun loadBeds() {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 } ?: return@launch
            when (val res = bedsRepository.getBeds(gardenId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(beds = res.data)
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    /** Создать грядку и сразу выбрать её — onSelected получает созданный объект. */
    fun createBed(name: String, type: String, onSelected: (GardenBed) -> Unit) {
        viewModelScope.launch {
            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 } ?: return@launch
            when (val res = bedsRepository.createBed(gardenId, name, type)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds + res.data)
                    onSelected(res.data)
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(error = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun renameBed(bed: GardenBed, name: String) {
        viewModelScope.launch {
            when (val res = bedsRepository.updateBed(bed.id, name = name)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(
                        beds = _uiState.value.beds.map { if (it.id == res.data.id) res.data else it }
                    )
                is Result.Error -> _uiState.value = _uiState.value.copy(error = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun deleteBed(bed: GardenBed) {
        viewModelScope.launch {
            when (val res = bedsRepository.deleteBed(bed.id)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds.filter { it.id != bed.id })
                is Result.Error -> _uiState.value = _uiState.value.copy(error = res.message)
                is Result.Loading -> Unit
            }
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

    fun confirmPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null, pendingCropFamily = null)
        createPlanting(cropId, date, quantity, conditions, sowingMethod, variety, bedId)
    }

    fun dismissSetupSheet() {
        _uiState.value = _uiState.value.copy(pendingCropId = null, pendingCropTransplantDays = null, pendingCropFamily = null)
    }

    private fun createPlanting(cropId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
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
                variety = variety,
                bedId = bedId
            )
            when (val result = plantingsRepository.createPlanting(request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка добавлена!")
                    loadPlantings()
                    loadBeds()
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun openEditSheet(planting: Planting) {
        _uiState.value = _uiState.value.copy(editingPlanting = planting, editingCropFamily = null)
        viewModelScope.launch {
            val family = (cropsRepository.getCrop(planting.cropId) as? Result.Success)?.data?.family
            _uiState.value = _uiState.value.copy(editingCropFamily = family)
        }
    }

    fun dismissEditSheet() {
        _uiState.value = _uiState.value.copy(editingPlanting = null, editingCropFamily = null)
    }

    fun saveEditedInfo(plantingId: Int, date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String? = null, bedId: Int? = null) {
        _uiState.value = _uiState.value.copy(editingPlanting = null, editingCropFamily = null)
        viewModelScope.launch {
            val request = UpdatePlantingInfoRequest(
                plantedAt = date, quantity = quantity, conditions = conditions,
                sowingMethod = sowingMethod, variety = variety ?: "", bedId = bedId
            )
            when (plantingsRepository.updateInfo(plantingId, request)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(successMessage = "Посадка обновлена!")
                    loadPlantings()
                    loadBeds()
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

    fun requestReminder(planting: Planting) {
        _uiState.value = _uiState.value.copy(reminderPlanting = planting)
    }

    fun dismissReminder() {
        _uiState.value = _uiState.value.copy(reminderPlanting = null)
    }

    fun setBedReminder(plantingId: Int, cropName: String?, intervalDays: Long) {
        reminderScheduler.scheduleRecurring(
            plantingId = plantingId,
            title = "Осмотр грядки",
            message = "Проверьте ${cropName ?: "грядку"} — самое время для осмотра",
            intervalDays = intervalDays
        )
        _uiState.value = _uiState.value.copy(reminderPlanting = null, successMessage = "Напоминание поставлено")
    }

    fun cancelBedReminder(plantingId: Int) {
        reminderScheduler.cancelRecurring(plantingId)
        _uiState.value = _uiState.value.copy(successMessage = "Напоминание отключено")
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null, error = null)
    }
}
