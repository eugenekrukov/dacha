package ru.dachakalend.app.ui.seeds

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.Seed
import ru.dachakalend.app.data.model.SeedShoppingItem
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.data.repository.SeedsRepository
import javax.inject.Inject

data class SeedsUiState(
    val seeds: List<Seed> = emptyList(),
    val shoppingList: List<SeedShoppingItem> = emptyList(),
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val error: String? = null,
    // Сейчас бэкенд не гейтит семена подпиской (нет 402), но поле держим для единообразия
    // со сборкой ошибок в Plantings/Harvest — если гейт появится, снекбар подхватит его сам.
    val errorIsSubscriptionRequired: Boolean = false,
    val showSheet: Boolean = false,
    val editing: Seed? = null,     // null при открытой шторке — добавление нового пакетика
    val prefillCropName: String? = null   // подстановка культуры при открытии из «Списка покупок»
) {
    val expiredCount: Int get() = seeds.count { it.expired }
}

@HiltViewModel
class SeedsViewModel @Inject constructor(
    private val repository: SeedsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeedsUiState())
    val uiState: StateFlow<SeedsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = repository.getSeeds()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(seeds = result.data, isLoading = false)
                is Result.Error -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false, errorIsSubscriptionRequired = result.isSubscriptionRequired)
                is Result.Loading -> Unit
            }
            // Список покупок — не блокирующая, второстепенная секция экрана: ошибку не показываем
            // отдельно (общий error-снекбар уже занят статусом основной загрузки), просто не рендерим блок.
            when (val shopping = repository.getShoppingList()) {
                is Result.Success -> _uiState.value = _uiState.value.copy(shoppingList = shopping.data)
                else -> Unit
            }
        }
    }

    fun openAdd(prefillCropName: String? = null) {
        _uiState.value = _uiState.value.copy(showSheet = true, editing = null, prefillCropName = prefillCropName)
    }
    fun openEdit(seed: Seed) { _uiState.value = _uiState.value.copy(showSheet = true, editing = seed) }
    fun closeSheet() { _uiState.value = _uiState.value.copy(showSheet = false, editing = null, prefillCropName = null) }
    fun clearError() { _uiState.value = _uiState.value.copy(error = null, errorIsSubscriptionRequired = false) }

    /**
     * Сохранение из шторки: новый пакетик создаётся, существующий обновляется.
     * [expiresOn] — "YYYY-MM" либо "" (снять срок). [photoBytes] грузится вторым запросом:
     * фото — отдельный multipart-эндпоинт, у нового пакетика id появляется только после создания.
     */
    fun save(seedId: Int?, cropName: String, variety: String?, expiresOn: String, photoBytes: ByteArray?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, error = null)
            val saved = if (seedId == null) {
                repository.createSeed(cropName, variety, expiresOn.ifEmpty { null })
            } else {
                repository.updateSeed(seedId, cropName = cropName, variety = variety ?: "", expiresOn = expiresOn)
            }
            when (saved) {
                is Result.Success -> {
                    if (photoBytes != null) {
                        when (val photo = repository.uploadPhoto(saved.data.id, photoBytes)) {
                            is Result.Error -> _uiState.value = _uiState.value.copy(error = photo.message, errorIsSubscriptionRequired = photo.isSubscriptionRequired)
                            else -> Unit
                        }
                    }
                    _uiState.value = _uiState.value.copy(isSaving = false, showSheet = false, editing = null)
                    load()
                }
                is Result.Error -> _uiState.value = _uiState.value.copy(isSaving = false, error = saved.message, errorIsSubscriptionRequired = saved.isSubscriptionRequired)
                is Result.Loading -> Unit
            }
        }
    }

    fun delete(seed: Seed) {
        viewModelScope.launch {
            when (val result = repository.deleteSeed(seed.id)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    seeds = _uiState.value.seeds.filterNot { it.id == seed.id }
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(error = result.message, errorIsSubscriptionRequired = result.isSubscriptionRequired)
                is Result.Loading -> Unit
            }
        }
    }
}
