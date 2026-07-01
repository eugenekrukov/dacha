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
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.PlantingPhoto
import ru.dachakalend.app.data.model.UpdatePlantingInfoRequest
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.BedsRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.GuideRepository
import ru.dachakalend.app.data.repository.PhotosRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class PlantingInfoUiState(
    val planting: Planting? = null,
    val crop: Crop? = null,
    val recentActions: List<ActionLog> = emptyList(),
    val problems: List<GuideEntry> = emptyList(),
    val beds: List<GardenBed> = emptyList(),
    val bedError: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    // Фото-дневник
    val photos: List<PlantingPhoto> = emptyList(),
    val uploadBusy: Boolean = false,
    val photoError: String? = null
)

@HiltViewModel
class PlantingInfoViewModel @Inject constructor(
    private val plantingsRepository: PlantingsRepository,
    private val cropsRepository: CropsRepository,
    private val actionsRepository: ActionsRepository,
    private val guideRepository: GuideRepository,
    private val photosRepository: PhotosRepository,
    private val bedsRepository: BedsRepository
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
            loadBeds(planting.gardenId)
            loadPhotos(plantingId)
        }
    }

    fun loadPhotos(plantingId: Int) {
        viewModelScope.launch {
            val res = photosRepository.getPhotos(plantingId)
            if (res is Result.Success) {
                _uiState.value = _uiState.value.copy(photos = res.data)
            }
        }
    }

    fun uploadPhoto(plantingId: Int, bytes: ByteArray, actionId: Int? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploadBusy = true, photoError = null)
            when (val res = photosRepository.uploadPhoto(plantingId, bytes, actionId = actionId)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(
                        photos = listOf(res.data) + _uiState.value.photos,
                        uploadBusy = false
                    )
                is Result.Error ->
                    _uiState.value = _uiState.value.copy(
                        uploadBusy = false,
                        // 409 от бэкенда = достигнут лимит фото (free 3 / paid 30 на посадку).
                        photoError = if (res.message.contains("409"))
                            "Достигнут лимит фото. Оформите подписку, чтобы добавить больше."
                        else "Не удалось загрузить фото"
                    )
                is Result.Loading -> Unit
            }
        }
    }

    /** Заменить кадр: грузим новый (тот же action_id) и только потом удаляем старый — при ошибке старое на месте. */
    fun replacePhoto(oldPhoto: PlantingPhoto, bytes: ByteArray) {
        val plantingId = _uiState.value.planting?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploadBusy = true, photoError = null)
            when (val up = photosRepository.uploadPhoto(plantingId, bytes, actionId = oldPhoto.actionId)) {
                is Result.Success -> {
                    photosRepository.deletePhoto(oldPhoto.id)
                    _uiState.value = _uiState.value.copy(
                        photos = listOf(up.data) + _uiState.value.photos.filter { it.id != oldPhoto.id },
                        uploadBusy = false
                    )
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(uploadBusy = false, photoError = "Не удалось заменить фото")
                is Result.Loading -> Unit
            }
        }
    }

    /** Удалить действие целиком: бэкенд удаляет и прикреплённые фото — чистим их из состояния. */
    fun deleteAction(actionId: Int) {
        viewModelScope.launch {
            if (actionsRepository.deleteAction(actionId) is Result.Success) {
                _uiState.value = _uiState.value.copy(
                    photos = _uiState.value.photos.filter { it.actionId != actionId },
                    recentActions = _uiState.value.recentActions.filter { it.id != actionId }
                )
            } else {
                _uiState.value = _uiState.value.copy(photoError = "Не удалось удалить запись")
            }
        }
    }

    fun deletePhoto(id: Int) {
        viewModelScope.launch {
            val res = photosRepository.deletePhoto(id)
            if (res is Result.Success) {
                _uiState.value = _uiState.value.copy(photos = _uiState.value.photos.filter { it.id != id })
            } else {
                _uiState.value = _uiState.value.copy(photoError = "Не удалось удалить фото")
            }
        }
    }

    fun clearPhotoError() {
        _uiState.value = _uiState.value.copy(photoError = null)
    }

    private fun loadBeds(gardenId: Int) {
        viewModelScope.launch {
            when (val res = bedsRepository.getBeds(gardenId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(beds = res.data)
                is Result.Error -> Unit
                is Result.Loading -> Unit
            }
        }
    }

    /** Привязать посадку к выбранной грядке (со снимком типа в условия — как при создании). */
    fun setBed(bed: GardenBed) {
        val planting = _uiState.value.planting ?: return
        viewModelScope.launch {
            when (val res = plantingsRepository.updateInfo(planting.id, UpdatePlantingInfoRequest(bedId = bed.id, conditions = bed.type))) {
                is Result.Success -> _uiState.value = _uiState.value.copy(planting = res.data, bedError = null)
                is Result.Error -> _uiState.value = _uiState.value.copy(bedError = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Изменить «Условия» (грунт/теплица) задним числом с карточки посадки. */
    fun setConditions(value: String) {
        val planting = _uiState.value.planting ?: return
        if (planting.conditions == value) return
        viewModelScope.launch {
            when (val res = plantingsRepository.updateInfo(planting.id, UpdatePlantingInfoRequest(conditions = value))) {
                is Result.Success -> _uiState.value = _uiState.value.copy(planting = res.data, bedError = null)
                is Result.Error -> _uiState.value = _uiState.value.copy(bedError = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun createAndSetBed(name: String, type: String) {
        val planting = _uiState.value.planting ?: return
        viewModelScope.launch {
            when (val created = bedsRepository.createBed(planting.gardenId, name, type)) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds + created.data, bedError = null)
                    setBed(created.data)
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(bedError = created.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun renameBed(bed: GardenBed, name: String) {
        viewModelScope.launch {
            when (val res = bedsRepository.updateBed(bed.id, name = name)) {
                is Result.Success ->
                    _uiState.value = _uiState.value.copy(beds = _uiState.value.beds.map { if (it.id == res.data.id) res.data else it })
                is Result.Error -> _uiState.value = _uiState.value.copy(bedError = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun deleteBed(bed: GardenBed) {
        viewModelScope.launch {
            when (val res = bedsRepository.deleteBed(bed.id)) {
                is Result.Success -> {
                    val planting = _uiState.value.planting
                    _uiState.value = _uiState.value.copy(
                        beds = _uiState.value.beds.filter { it.id != bed.id },
                        // ON DELETE SET NULL на сервере: если удалили текущую грядку — локально снимаем привязку.
                        planting = if (planting?.bedId == bed.id) planting.copy(bedId = null) else planting
                    )
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(bedError = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun reset() {
        loadedPlantingId = -1
        _uiState.value = PlantingInfoUiState()
    }
}
