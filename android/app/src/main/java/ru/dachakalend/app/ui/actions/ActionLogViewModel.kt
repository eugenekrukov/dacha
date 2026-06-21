package ru.dachakalend.app.ui.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.PhotosRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class ActionLogUiState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null
)

// Метки без эмодзи: иконку даёт actionIcon() (Material Icons) — единообразно с журналом.
val ACTION_TYPES = listOf(
    "watering"      to "Полив",
    "fertilizing"   to "Подкормка",
    "treatment"     to "Обработка",
    "pricking_out"  to "Пикировка",
    "transplanting" to "Высадка",
    "tying"         to "Подвязка",
    "pinching"      to "Пасынкование",
    "hilling"       to "Окучивание",
    "pruning"       to "Обрезка",
    "weeding"       to "Прополка",
    "loosening"     to "Рыхление",
    "thinning"      to "Прореживание",
    "runner_removal" to "Удаление усов",
    "bolt_removal"  to "Удаление стрелок",
    "deflowering"   to "Удаление цветков",
    "staking"       to "Установка опоры",
    "other"         to "Другое"
)

// Маппинг care_task_name → action_type. По КЛЮЧЕВОМУ СЛОВУ (имена в БД описательные:
// «Первое окучивание», «Обработка от капустной мухи», «Обрезка нижних листьев»).
// Должен совпадать с careTaskActionType() на бэкенде (utils/todayLogic.js).
// Незамапленные имена → "other" (на сервере — null: задача не закрывается этим действием).
fun careTaskActionType(careTaskName: String?): String {
    val n = careTaskName?.lowercase() ?: return "other"
    return when {
        n.contains("подвяз")                        -> "tying"
        n.contains("пасынк") || n.contains("прищип") -> "pinching"
        n.contains("окучив")                        -> "hilling"
        n.contains("обрезк")                        -> "pruning"
        n.contains("прополк")                       -> "weeding"
        n.contains("рыхлен")                        -> "loosening"
        n.contains("обработк") || n.contains("опрыск") -> "treatment"
        n.contains("прореж") || n.contains("нормиров") -> "thinning"
        n.contains("усов") || n.contains("усы")      -> "runner_removal"
        n.contains("стрел")                          -> "bolt_removal"
        n.contains("цветонос") || n.contains("увядш") || n.contains("завяз") -> "deflowering"
        n.contains("опор")                           -> "staking"
        else                                         -> "other"
    }
}

/**
 * Заметка, которую осмысленно авто-подставить при логировании care-задачи-обработки.
 * Название действия (Прополка, Рыхление…) в заметку НЕ пишем — оно и так выбрано типом.
 * Для «Обработки» подставляем «от чего - препарат» (например, «от капустной мухи - Базудин»),
 * т.к. это уточняет действие. Для остального — null (пустая заметка).
 */
fun treatmentNote(careTaskName: String?, product: String? = null): String? {
    if (careTaskName == null) return null
    if (careTaskActionType(careTaskName) != "treatment") return null
    val target = careTaskName.replaceFirst(Regex("(?i)^обработка\\s*"), "").trim().ifBlank { null }
    val prod = product?.trim()?.ifBlank { null }
    return when {
        target != null && prod != null -> "$target - $prod"
        else                           -> target ?: prod
    }
}

@HiltViewModel
class ActionLogViewModel @Inject constructor(
    private val actionsRepository: ActionsRepository,
    private val photosRepository: PhotosRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ActionLogUiState())
    val uiState: StateFlow<ActionLogUiState> = _uiState.asStateFlow()

    fun reset() {
        _uiState.value = ActionLogUiState()
    }

    // Фото прикрепляем к записанному действию. Ошибка загрузки фото НЕ откатывает действие
    // (действие важнее). Офлайн-действие (синтетический отрицательный id) — без фото.
    private suspend fun maybeUploadPhoto(plantingId: Int, action: ActionLog, photoBytes: ByteArray?) {
        if (photoBytes == null) return
        val actionId = action.id.takeIf { it > 0 } ?: return
        photosRepository.uploadPhoto(plantingId, photoBytes, actionId = actionId)
    }

    fun logAction(plantingId: Int, type: String, notes: String? = null, auto: Boolean = false, photoBytes: ByteArray? = null) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            when (val result = actionsRepository.logAction(plantingId, type, notes, auto)) {
                is Result.Success -> {
                    maybeUploadPhoto(plantingId, result.data, photoBytes)
                    _uiState.value = ActionLogUiState(success = true)
                }
                is Result.Error   -> _uiState.value = ActionLogUiState(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Логирует "Высаживание" и переводит стадию в transplanted. Офлайн-устойчиво (очередь). */
    fun logTransplanting(plantingId: Int, photoBytes: ByteArray? = null) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            val logRes = actionsRepository.logAction(plantingId, "transplanting", null)
            if (logRes is Result.Success) maybeUploadPhoto(plantingId, logRes.data, photoBytes)
            when (val result = actionsRepository.changeStage(plantingId, "transplanted")) {
                is Result.Success -> _uiState.value = ActionLogUiState(success = true)
                is Result.Error   -> _uiState.value = ActionLogUiState(error = result.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Мульти-посадочное действие: одно действие пишется во все переданные посадки
     *  (групповая care-задача «Прополка: Капуста, Редис»). Последовательно — первая
     *  ошибка прерывает и показывается пользователю. Список из одной посадки эквивалентен logAction. */
    fun logActionMulti(plantingIds: List<Int>, type: String, notes: String? = null, auto: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            for (id in plantingIds) {
                val result = actionsRepository.logAction(id, type, notes, auto)
                if (result is Result.Error) {
                    _uiState.value = ActionLogUiState(error = result.message)
                    return@launch
                }
            }
            _uiState.value = ActionLogUiState(success = true)
        }
    }

    /** Мульти-посадочная «Высадка»: фиксирует действие и переводит каждую посадку в transplanted. */
    fun logTransplantingMulti(plantingIds: List<Int>) {
        viewModelScope.launch {
            _uiState.value = ActionLogUiState(isLoading = true)
            for (id in plantingIds) {
                actionsRepository.logAction(id, "transplanting", null)
                val result = actionsRepository.changeStage(id, "transplanted")
                if (result is Result.Error) {
                    _uiState.value = ActionLogUiState(error = result.message)
                    return@launch
                }
            }
            _uiState.value = ActionLogUiState(success = true)
        }
    }
}
